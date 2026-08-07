import { describe, expect, test, vi } from "vitest";
import { detectEvmContractChains } from "@/helpers/ipc/config/rpc-chain-detector";

const ADDRESS = "0xa50a51c09a5c451c52bb714527e1974b686d8e77";

describe("detectEvmContractChains", () => {
  test("returns only candidate chains that contain contract code", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const result = url.includes("base-mainnet") ? "0x60016000" : "0x";
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const result = await detectEvmContractChains({
      apiKey: "user-key",
      address: ADDRESS,
      candidateTokens: ["bsc", "base", "eth"],
      fetchImpl,
    });

    expect(result).toEqual(["base"]);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  test("does not request RPC without a key", async () => {
    const fetchImpl = vi.fn() as typeof fetch;

    const result = await detectEvmContractChains({
      apiKey: "",
      address: ADDRESS,
      candidateTokens: ["bsc", "base"],
      fetchImpl,
    });

    expect(result).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
