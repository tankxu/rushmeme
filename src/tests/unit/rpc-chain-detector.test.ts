import { describe, expect, test, vi } from "vitest";
import {
  detectEvmContractChains,
  testAlchemyApiKey,
} from "@/helpers/ipc/config/rpc-chain-detector";

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

describe("testAlchemyApiKey", () => {
  test("accepts a key when Alchemy returns a block number", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x1234" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const result = await testAlchemyApiKey({
      apiKey: "valid-user-key",
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("reports an unauthorized key", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("Unauthorized", { status: 401 }),
    ) as typeof fetch;

    const result = await testAlchemyApiKey({
      apiKey: "invalid-user-key",
      fetchImpl,
    });

    expect(result).toEqual({
      ok: false,
      status: 401,
      reason: "unauthorized",
    });
  });
});
