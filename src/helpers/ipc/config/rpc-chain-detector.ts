import { normalizeChainTokenKey } from "@/utils/chain";
import type { AlchemyApiKeyTestResult } from "@/types/config";

type RpcNetwork = {
  canonicalToken: string;
  aliases: string[];
  endpoint: string;
};

const ALCHEMY_EVM_NETWORKS: RpcNetwork[] = [
  {
    canonicalToken: "eth",
    aliases: ["eth", "ethereum"],
    endpoint: "eth-mainnet",
  },
  {
    canonicalToken: "bsc",
    aliases: ["bsc", "bnb", "bnbchain"],
    endpoint: "bnb-mainnet",
  },
  { canonicalToken: "base", aliases: ["base"], endpoint: "base-mainnet" },
  {
    canonicalToken: "mantle",
    aliases: ["mantle"],
    endpoint: "mantle-mainnet",
  },
  {
    canonicalToken: "arbitrum",
    aliases: ["arbitrum", "arb"],
    endpoint: "arb-mainnet",
  },
  {
    canonicalToken: "optimism",
    aliases: ["optimism", "op"],
    endpoint: "opt-mainnet",
  },
  {
    canonicalToken: "polygon",
    aliases: ["polygon", "matic"],
    endpoint: "polygon-mainnet",
  },
  {
    canonicalToken: "avalanche",
    aliases: ["avalanche", "avax"],
    endpoint: "avax-mainnet",
  },
  { canonicalToken: "linea", aliases: ["linea"], endpoint: "linea-mainnet" },
  { canonicalToken: "scroll", aliases: ["scroll"], endpoint: "scroll-mainnet" },
  { canonicalToken: "zksync", aliases: ["zksync"], endpoint: "zksync-mainnet" },
  { canonicalToken: "blast", aliases: ["blast"], endpoint: "blast-mainnet" },
];

type DetectEvmContractChainsOptions = {
  apiKey: string;
  address: string;
  candidateTokens: string[];
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

type RpcPayload = {
  result?: unknown;
  error?: unknown;
};

type TestAlchemyApiKeyOptions = {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export async function testAlchemyApiKey({
  apiKey,
  fetchImpl = fetch,
  timeoutMs = 8_000,
}: TestAlchemyApiKeyOptions): Promise<AlchemyApiKeyTestResult> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    return { ok: false, reason: "missing_key" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetchImpl(
      `https://eth-mainnet.g.alchemy.com/v2/${encodeURIComponent(trimmedKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_blockNumber",
          params: [],
        }),
        signal: controller.signal,
      },
    );

    if (response.status === 401 || response.status === 403) {
      return { ok: false, status: response.status, reason: "unauthorized" };
    }
    if (response.status === 429) {
      return { ok: false, status: response.status, reason: "rate_limited" };
    }
    if (!response.ok) {
      return { ok: false, status: response.status, reason: "unreachable" };
    }

    const payload = (await response.json()) as RpcPayload;
    if (
      payload.error ||
      typeof payload.result !== "string" ||
      !/^0x[0-9a-f]+$/i.test(payload.result)
    ) {
      return { ok: false, reason: "unauthorized" };
    }

    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch {
    return { ok: false, reason: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

function hasContractCode(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith("0x") && !/^0x0*$/.test(normalized);
}

export async function detectEvmContractChains({
  apiKey,
  address,
  candidateTokens,
  fetchImpl = fetch,
  timeoutMs = 5_000,
}: DetectEvmContractChainsOptions): Promise<string[]> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return [];
  }

  const normalizedCandidates = new Set(
    candidateTokens.map(normalizeChainTokenKey).filter(Boolean),
  );
  const networks = ALCHEMY_EVM_NETWORKS.filter((network) =>
    network.aliases.some((alias) => normalizedCandidates.has(alias)),
  );

  const detected = await Promise.all(
    networks.map(async (network, index) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(
          `https://${network.endpoint}.g.alchemy.com/v2/${encodeURIComponent(trimmedKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: index + 1,
              method: "eth_getCode",
              params: [address, "latest"],
            }),
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          return [];
        }
        const payload = (await response.json()) as RpcPayload;
        if (payload.error || !hasContractCode(payload.result)) {
          return [];
        }

        return [
          network.canonicalToken,
          ...network.aliases.filter((alias) => normalizedCandidates.has(alias)),
        ];
      } catch {
        return [];
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  return Array.from(new Set(detected.flat()));
}
