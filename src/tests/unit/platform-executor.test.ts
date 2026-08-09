import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AppConfig, PlatformConfig } from "@/types/config";

const { openExternal, detectEvmContractChains } = vi.hoisted(() => ({
  openExternal: vi.fn(async () => undefined),
  detectEvmContractChains: vi.fn(),
}));

vi.mock("electron", () => ({
  clipboard: {
    readText: vi.fn(() => ""),
    writeText: vi.fn(),
  },
  shell: { openExternal },
  Notification: class {
    static isSupported() {
      return false;
    }
    show() {}
  },
  systemPreferences: {},
}));

vi.mock("@/helpers/ipc/config/rpc-chain-detector", () => ({
  detectEvmContractChains,
}));

import {
  executePlatforms,
  maybeRunSmartChainCorrection,
  type PendingPlatformUrl,
} from "@/helpers/ipc/config/platform-executor";

const ADDRESS = "0xa50a51c09a5c451c52bb714527e1974b686d8e77";

describe("smart chain correction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("opens a matching destination when detection differs from the initial chain", async () => {
    detectEvmContractChains.mockResolvedValue(["base"]);

    const platform: PlatformConfig = {
      id: "dexscreener-1",
      key: "dexscreener",
      name: "DexScreener",
      enabled: true,
      tokenType: "BSC | Base",
      shortcut: "⌃1",
      shortcuts: [{ tokenType: "BSC | Base", shortcut: "⌃1" }],
      urls: [
        { chain: "bsc", url: "https://dexscreener.com/bsc/{CA}" },
        { chain: "base", url: "https://dexscreener.com/base/{CA}" },
      ],
    };
    const initialUrl = `https://dexscreener.com/bsc/${ADDRESS}`;
    const pendingUrls: PendingPlatformUrl[] = [
      {
        url: initialUrl,
        platform,
        address: ADDRESS,
        chain: "bsc",
        chainTokens: ["bsc"],
        addressType: "evm",
      },
    ];
    const config: AppConfig = {
      platforms: [platform],
      notifications: { enabled: false },
      browserDelayMs: 0,
      smartChainCorrectionEnabled: true,
      alchemyApiKey: "user-rpc-key",
      excludeActiveApp: false,
      includeActiveAppOnly: false,
      excludedApps: [],
      includedApps: [],
    };

    await maybeRunSmartChainCorrection(config, {
      address: ADDRESS,
      addressType: "evm",
      pendingUrls,
      openedUrls: [initialUrl],
    });

    expect(detectEvmContractChains).toHaveBeenCalledWith({
      apiKey: "user-rpc-key",
      address: ADDRESS,
      candidateTokens: ["bsc", "base"],
    });
    expect(openExternal).toHaveBeenCalledOnce();
    expect(openExternal).toHaveBeenCalledWith(
      `https://dexscreener.com/base/${ADDRESS}`,
    );
  });
});

describe("platform execution failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createConfig = (url: string): AppConfig => ({
    platforms: [
      {
        id: "custom-1",
        key: "custom",
        name: "Custom",
        enabled: true,
        tokenType: "Base",
        shortcut: "⌃1",
        shortcuts: [{ tokenType: "Base", shortcut: "⌃1" }],
        urls: [{ chain: "base", url }],
      },
    ],
    notifications: { enabled: false },
    browserDelayMs: 0,
    smartChainCorrectionEnabled: false,
    alchemyApiKey: "",
    excludeActiveApp: false,
    includeActiveAppOnly: false,
    excludedApps: [],
    includedApps: [],
  });

  test("returns a failure instead of rejecting when the OS cannot open a URL", async () => {
    openExternal.mockRejectedValueOnce(new Error("open failed"));

    const result = await executePlatforms(
      createConfig("https://dexscreener.com/base/{CA}"),
      { overrideAddress: ADDRESS, bypassAppFilters: true },
    );

    expect(result.success).toBe(false);
    expect(result.opened).toEqual([]);
    expect(result.error).toBe("Failed to open the configured destinations.");
  });

  test("refuses unsafe custom URL schemes", async () => {
    const result = await executePlatforms(createConfig("file:///tmp/{CA}"), {
      overrideAddress: ADDRESS,
      bypassAppFilters: true,
    });

    expect(result.success).toBe(false);
    expect(openExternal).not.toHaveBeenCalled();
  });

  test("blocks execution when an enabled allowlist is empty", async () => {
    const config = createConfig("https://dexscreener.com/base/{CA}");
    config.includeActiveAppOnly = true;

    const result = await executePlatforms(config, { overrideAddress: ADDRESS });

    expect(result.success).toBe(false);
    expect(result.skippedBecauseExcluded).toBe(true);
    expect(openExternal).not.toHaveBeenCalled();
  });
});
