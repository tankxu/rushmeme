import type { PlatformUrlTemplate } from "@/types/config";

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export type AddressType = "evm" | "solana" | "unknown";

const BASE58_CHAR_SET = new Set(BASE58_ALPHABET.split(""));

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

function looksLikeSolanaAddress(value: string): boolean {
  if (value.length < 32 || value.length > 44) {
    return false;
  }
  for (const char of value) {
    if (!BASE58_CHAR_SET.has(char)) {
      return false;
    }
  }
  return true;
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
