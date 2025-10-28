import type { PlatformUrlTemplate } from "@/types/config";

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export type AddressType = "evm" | "solana" | "unknown";

const BASE58_DIGIT_MAP = new Map(
  BASE58_ALPHABET.split("").map((char, index) => [char, index] as const),
);

function normalizeSpec(spec: string): string {
  return spec
    .toLowerCase()
    .replace(/\[|\]/g, "")
    .replace(/,/g, "|")
    .replace(/\//g, "|")
    .replace(/\s*\|\s*/g, "|")
    .trim();
}

export function normalizeChainTokenKey(token: string): string {
  return token
    .trim()
    .toLowerCase()
    .replace(/\[|\]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function parseChainSpec(spec: string): string[] {
  const normalized = normalizeSpec(spec);
  if (!normalized) {
    return [];
  }

  return normalized
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function formatChainLabel(spec: string): string {
  const tokens = parseChainSpec(spec);
  if (tokens.length === 0) {
    return "[any]";
  }

  const formattedTokens = tokens.map((token) => token.replace(/\s+/g, "-"));

  return `[${formattedTokens.join("|")}]`;
}

export function extractChainSpecFromUrl(
  url: string,
  fallback?: string,
): string {
  const match = url.match(/\[([^\]]+)\]/);
  if (!match) {
    return formatChainLabel(fallback ?? "");
  }

  return formatChainLabel(match[1]);
}

export function normalizeUrlTemplates(
  entries: PlatformUrlTemplate[],
  fallback: string,
): PlatformUrlTemplate[] {
  return entries.flatMap((entry) => {
    const fallbackSpec = entry.chain ?? fallback;
    const normalizedChain = extractChainSpecFromUrl(entry.url, fallbackSpec);
    const tokens = parseChainSpec(normalizedChain);
    const effectiveTokens =
      tokens.length > 0 ? tokens : parseChainSpec(fallbackSpec);

    if (entry.url.includes("[") && effectiveTokens.length > 0) {
      return effectiveTokens.map((token) => ({
        ...entry,
        url: entry.url.replace(/\[([^\]]+)\]/g, token),
        chain: formatChainLabel(token),
      }));
    }

    if (!entry.url.includes("[") && effectiveTokens.length > 1) {
      return effectiveTokens.map((token) => ({
        ...entry,
        chain: formatChainLabel(token),
      }));
    }

    const resolvedChain =
      effectiveTokens.length === 1
        ? formatChainLabel(effectiveTokens[0])
        : normalizedChain || formatChainLabel(fallbackSpec);

    return [
      {
        ...entry,
        chain: resolvedChain,
      },
    ];
  });
}

const EVM_CHAIN_ALIASES = new Set(
  [
    "evm",
    "ethereum",
    "eth",
    "bsc",
    "bnb",
    "bnb-chain",
    "base",
    "arbitrum",
    "arb",
    "optimism",
    "op",
    "polygon",
    "matic",
    "avalanche",
    "avax",
    "fantom",
    "ftm",
    "linea",
    "scroll",
    "zksync",
    "x-layer",
    "xlayer",
    "zk",
    "blast",
  ].map(normalizeChainTokenKey),
);

const SOLANA_CHAIN_ALIASES = new Set(
  ["sol", "solana"].map(normalizeChainTokenKey),
);

function pickPreferredAlias(
  tokens: string[],
  addressType: AddressType,
): string | undefined {
  if (tokens.length === 0) {
    return undefined;
  }

  if (addressType === "unknown") {
    return tokens[0];
  }

  if (addressType === "evm") {
    return (
      tokens.find((token) =>
        EVM_CHAIN_ALIASES.has(normalizeChainTokenKey(token)),
      ) ?? tokens[0]
    );
  }

  if (addressType === "solana") {
    return (
      tokens.find((token) =>
        SOLANA_CHAIN_ALIASES.has(normalizeChainTokenKey(token)),
      ) ?? tokens[0]
    );
  }

  return tokens[0];
}

export function chainSupportsAddressType(
  spec: string,
  addressType: AddressType,
): boolean {
  if (addressType === "unknown") {
    return true;
  }

  const tokens = parseChainSpec(spec);
  if (tokens.length === 0) {
    return true;
  }

  if (tokens.includes("any")) {
    return true;
  }

  if (addressType === "solana") {
    return tokens.some((token) =>
      SOLANA_CHAIN_ALIASES.has(normalizeChainTokenKey(token)),
    );
  }

  if (addressType === "evm") {
    return tokens.some((token) =>
      EVM_CHAIN_ALIASES.has(normalizeChainTokenKey(token)),
    );
  }

  return false;
}

export function resolveUrlForAddress(
  url: string,
  spec: string,
  addressType: AddressType,
): string {
  if (!url.includes("[")) {
    return url;
  }

  const tokens = parseChainSpec(spec);
  const alias = pickPreferredAlias(tokens, addressType) ?? tokens[0] ?? "";
  const pattern = /\[([^\]]+)\]/g;

  return url.replace(pattern, alias ?? "");
}

function looksLikeEvmAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

function decodeBase58(value: string): Uint8Array | null {
  if (!value) {
    return new Uint8Array(0);
  }

  let accumulator = 0n;
  for (const char of value) {
    const digit = BASE58_DIGIT_MAP.get(char);
    if (digit === undefined) {
      return null;
    }
    accumulator = accumulator * 58n + BigInt(digit);
  }

  const bytes: number[] = [];
  while (accumulator > 0n) {
    bytes.push(Number(accumulator % 256n));
    accumulator /= 256n;
  }

  let leadingZeros = 0;
  for (const char of value) {
    if (char === "1") {
      leadingZeros += 1;
    } else {
      break;
    }
  }

  const decoded = new Uint8Array(leadingZeros + bytes.length);
  const totalLength = decoded.length;
  for (let index = 0; index < bytes.length; index += 1) {
    decoded[totalLength - 1 - index] = bytes[index];
  }

  return decoded;
}

function looksLikeSolanaAddress(value: string): boolean {
  if (value.length < 32 || value.length > 44) {
    return false;
  }

  const decoded = decodeBase58(value);
  return decoded !== null && decoded.length === 32;
}

export function detectAddressType(address: string): AddressType {
  const trimmed = address.trim();
  if (looksLikeEvmAddress(trimmed)) {
    return "evm";
  }

  if (looksLikeSolanaAddress(trimmed)) {
    return "solana";
  }

  return "unknown";
}

export type DetectedAddress = {
  address: string;
  type: AddressType;
};

export function extractAddressesFromText(text: string): DetectedAddress[] {
  if (!text) {
    return [];
  }

  type Candidate = DetectedAddress & { index: number };
  const candidates: Candidate[] = [];
  const seen = new Set<string>();

  const registerCandidate = (address: string, type: AddressType, index: number) => {
    const key = type === "solana" ? address : address.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push({ address, type, index });
    }
  };

  {
    const evmRegex = /0x[0-9a-fA-F]{40}/g;
    let match: RegExpExecArray | null;
    while ((match = evmRegex.exec(text)) !== null) {
      const candidateAddress = match[0];
      registerCandidate(candidateAddress, "evm", match.index);
    }
  }

  {
    const base58Class = "1-9A-HJ-NP-Za-km-z";
    const solanaRegex = new RegExp(
      `(?<![${base58Class}])([${base58Class}]{32,44})(?![${base58Class}])`,
      "g",
    );
    let match: RegExpExecArray | null;
    while ((match = solanaRegex.exec(text)) !== null) {
      const candidateAddress = match[1];
      if (looksLikeSolanaAddress(candidateAddress)) {
        registerCandidate(candidateAddress, "solana", match.index);
      }
    }
  }

  candidates.sort((a, b) => a.index - b.index);
  return candidates.map(({ address, type }) => ({ address, type }));
}
