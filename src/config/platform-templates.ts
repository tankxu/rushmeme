import type { PlatformTemplate } from "@/types/config";

export const PLATFORM_TEMPLATES: PlatformTemplate[] = [
  {
    key: "binance-wallet",
    name: "Binance Wallet",
    tokenType: "BSC | Solana",
    shortcut: "⌘⇧C",
    enabled: false,
    urls: [
      {
        chain: "bsc",
        url: "https://web3.binance.com/en/token/bsc/{CA}",
      },
      {
        chain: "base",
        url: "https://web3.binance.com/en/token/base/{CA}",
      },
      {
        chain: "solana",
        url: "https://web3.binance.com/en/token/sol/{CA}",
      },
    ],
  },
  {
    key: "okx-wallet",
    name: "OKX Wallet",
    tokenType: "BSC | Solana",
    shortcut: "⌘⇧1",
    enabled: false,
    urls: [
      {
        chain: "bsc",
        url: "https://web3.okx.com/token/bsc/{CA}",
      },
      {
        chain: "base",
        url: "https://web3.okx.com/token/base/{CA}",
      },
      { chain: "xlayer", url: "https://web3.okx.com/token/x-layer/{CA}" },
      { chain: "eth", url: "https://web3.okx.com/token/ethereum/{CA}" },
      {
        chain: "solana",
        url: "https://web3.okx.com/token/solana/{CA}",
      },
    ],
  },
  {
    key: "dexscreener",
    name: "DexScreener",
    tokenType: "Any",
    shortcut: "⌘⇧2",
    enabled: false,
    urls: [{ chain: "any", url: "https://dexscreener.com/?token={CA}" }],
  },
  {
    key: "gmgn",
    name: "GMGN",
    tokenType: "Base | Solana",
    shortcut: "⌘⇧3",
    enabled: false,
    urls: [
      {
        chain: "base",
        url: "https://gmgn.ai/token/base/{CA}",
      },
      {
        chain: "solana",
        url: "https://gmgn.ai/token/solana/{CA}",
      },
    ],
  },
  {
    key: "raydium",
    name: "Raydium",
    tokenType: "Solana",
    shortcut: "⌘⇧4",
    enabled: false,
    urls: [
      {
        chain: "solana",
        url: "https://raydium.io/swap/?inputMint=sol&outputMint={CA}",
      },
    ],
  },
  {
    key: "debot",
    name: "Debot",
    tokenType: "BSC | Solana",
    shortcut: "",
    enabled: false,
    catalogOnly: true,
    urls: [
      {
        chain: "bsc",
        url: "https://debot.ai/token/bsc/{CA}",
      },
      { chain: "solana", url: "https://debot.ai/token/solana/{CA}" },
      { chain: "base", url: "https://debot.ai/token/base/{CA}" },
      { chain: "xlayer", url: "https://debot.ai/token/xlayer/{CA}" },
      { chain: "eth", url: "https://debot.ai/token/eth/{CA}" },
    ],
  },
  {
    key: "fourmeme",
    name: "Four Meme",
    tokenType: "BSC",
    shortcut: "",
    enabled: false,
    catalogOnly: true,
    urls: [
      {
        chain: "bsc",
        url: "https://four.meme/token/{CA}",
      },
    ],
  },
  {
    key: "pumpfun",
    name: "Pump Fun",
    tokenType: "Solana",
    shortcut: "",
    enabled: false,
    catalogOnly: true,
    urls: [
      {
        chain: "solana",
        url: "https://pump.fun/coin/{CA}",
      },
    ],
  },
  {
    key: "x",
    name: "X (Twitter)",
    tokenType: "Any",
    shortcut: "⌃X",
    enabled: false,
    urls: [
      {
        chain: "any",
        url: "https://x.com/search?q={CA}",
      },
    ],
  },
];

export const DEFAULT_BROWSER_DELAY = 2000;
