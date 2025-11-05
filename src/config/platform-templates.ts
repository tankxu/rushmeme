import type { PlatformTemplate } from "@/types/config";

export const PLATFORM_TEMPLATES: PlatformTemplate[] = [
  {
    key: "binance-wallet",
    name: "Binance Wallet",
    enabled: false,
    shortcuts: [
      {
        tokenType: "BSC | Solana",
        shortcut: "⌃1",
      },
    ],
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
    enabled: false,
    shortcuts: [
      {
        tokenType: "Base | Solana",
        shortcut: "⌃2",
      },
    ],
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
    key: "gmgn",
    name: "GMGN",
    enabled: false,
    shortcuts: [
      {
        tokenType: "Base | Solana",
        shortcut: "⌃3",
      },
    ],
    urls: [
      {
        chain: "base",
        url: "https://gmgn.ai/base/token/{CA}",
      },
      {
        chain: "solana",
        url: "https://gmgn.ai/solana/token/{CA}",
      },
      {
        chain: "bsc",
        url: "https://gmgn.ai/bsc/token/{CA}",
      },
      {
        chain: "eth",
        url: "https://gmgn.ai/eth/token/{CA}",
      },
      {
        chain: "tron",
        url: "https://gmgn.ai/tron/token/{CA}",
      },
    ],
  },
  {
    key: "dexscreener",
    name: "DexScreener",
    enabled: false,
    shortcuts: [
      {
        tokenType: "Solana",
        shortcut: "",
      },
    ],
    urls: [
      { chain: "solana", url: "https://dexscreener.com/solana/{CA}" },
      { chain: "bsc", url: "https://dexscreener.com/bsc/{CA}" },
      { chain: "base", url: "https://dexscreener.com/base/{CA}" },
      { chain: "eth", url: "https://dexscreener.com/ethereum/{CA}" },
      { chain: "sui", url: "https://dexscreener.com/sui/{CA}" },
      { chain: "mantle", url: "https://dexscreener.com/mantle/{CA}" },
      { chain: "tron", url: "https://dexscreener.com/tron/{CA}" },
    ],
  },
  {
    key: "raydium",
    name: "Raydium",
    enabled: false,
    catalogOnly: true,
    shortcuts: [
      {
        tokenType: "Solana",
        shortcut: "",
      },
    ],
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
    enabled: false,
    catalogOnly: true,
    shortcuts: [
      {
        tokenType: "BSC | Solana",
        shortcut: "",
      },
    ],
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
    enabled: false,
    catalogOnly: true,
    shortcuts: [
      {
        tokenType: "BSC",
        shortcut: "",
      },
    ],
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
    enabled: false,
    catalogOnly: true,
    shortcuts: [
      {
        tokenType: "Solana",
        shortcut: "",
      },
    ],
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
    enabled: false,
    shortcuts: [
      {
        tokenType: "Any",
        shortcut: "⌃X",
      },
    ],
    urls: [
      {
        chain: "any",
        url: "https://x.com/search?q={ANY}",
      },
    ],
    variableType: "ANY",
  },
  {
    key: "oklink",
    name: "OKLink Multi Search",
    enabled: false,
    catalogOnly: true,
    shortcuts: [
      {
        tokenType: "Any",
        shortcut: "",
      },
    ],
    urls: [
      {
        chain: "any",
        url: "https://www.oklink.com/multi-search#key={ANY}",
      },
    ],
    variableType: "ANY",
  },
];

export const DEFAULT_BROWSER_DELAY = 2000;
