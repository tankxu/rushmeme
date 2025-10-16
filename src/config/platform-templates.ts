import type { PlatformTemplate } from "@/types/config";

export const PLATFORM_TEMPLATES: PlatformTemplate[] = [
  {
    key: "binance-wallet",
    name: "Binance Wallet",
    tokenType: "BSC",
    shortcut: "⌘⇧1",
    enabled: true,
    urls: [
      { chain: "BSC", url: "https://web3.binance.com/en/token/bsc/{CA}" },
    ],
  },
  {
    key: "okx-wallet",
    name: "OKX Wallet",
    tokenType: "BSC | Solana",
    shortcut: "⌘⇧2",
    enabled: true,
    urls: [
      { chain: "BSC", url: "https://web3.okx.com/token/bsc/{CA}" },
      { chain: "Solana", url: "https://web3.okx.com/token/solana/{CA}" },
    ],
  },
  {
    key: "dexscreener",
    name: "DexScreener",
    tokenType: "Any",
    shortcut: "⌘⇧3",
    enabled: true,
    urls: [{ chain: "Any", url: "https://dexscreener.com/?token={CA}" }],
  },
  {
    key: "gmgn",
    name: "GMGN",
    tokenType: "Base | Solana",
    shortcut: "⌘⇧4",
    enabled: true,
    urls: [
      { chain: "Base", url: "https://gmgn.ai/token/base/{CA}" },
      { chain: "Solana", url: "https://gmgn.ai/token/solana/{CA}" },
    ],
  },
  {
    key: "debot",
    name: "Debot",
    tokenType: "EVM",
    shortcut: "⌘⇧5",
    enabled: false,
    requiresPro: true,
    urls: [{ chain: "EVM", url: "https://app.debot.xyz/token/{CA}" }],
  },
  {
    key: "raydium",
    name: "Raydium",
    tokenType: "Solana",
    shortcut: "⌘⇧6",
    enabled: false,
    requiresPro: true,
    urls: [{ chain: "Solana", url: "https://raydium.io/swap/?input={CA}" }],
  },
];

export const DEFAULT_BROWSER_DELAY = 1000;
