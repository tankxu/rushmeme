const MAC_SYMBOLS = new Map<string, string>([
  ["⌘", "Command"],
  ["⌃", "Control"],
  ["⌥", "Alt"],
  ["⇧", "Shift"],
]);

const WORD_MODIFIERS = new Map<string, string>([
  ["ctrl", "Control"],
  ["control", "Control"],
  ["shift", "Shift"],
  ["alt", "Alt"],
  ["option", "Alt"],
  ["cmd", "Command"],
  ["command", "Command"],
  ["win", "Super"],
  ["super", "Super"],
  ["meta", "Super"],
]);

export function convertDisplayShortcutToAccelerator(shortcut: string | undefined | null) {
  if (!shortcut) {
    return undefined;
  }

  const trimmed = shortcut.trim();
  if (!trimmed) {
    return undefined;
  }

  const modifiers: string[] = [];
  let key: string | undefined;

  const containsMacSymbols = [...MAC_SYMBOLS.keys()].some((symbol) =>
    trimmed.includes(symbol),
  );

  if (containsMacSymbols) {
    for (const [symbol, accelerator] of MAC_SYMBOLS.entries()) {
      if (trimmed.includes(symbol)) {
        modifiers.push(accelerator);
      }
    }

    const withoutSymbols = trimmed.replace(/[⌘⌃⌥⇧\s+]/g, "");
    if (withoutSymbols) {
      key = withoutSymbols.length === 1 ? withoutSymbols.toUpperCase() : withoutSymbols;
    }
  } else {
    const segments = trimmed.split(/\s*\+\s*/);
    for (const segmentRaw of segments) {
      const segment = segmentRaw.trim();
      if (!segment) continue;
      const lower = segment.toLowerCase();
      if (WORD_MODIFIERS.has(lower)) {
        const mapped = WORD_MODIFIERS.get(lower);
        if (mapped && !modifiers.includes(mapped)) {
          modifiers.push(mapped);
        }
      } else {
        key = segment.length === 1 ? segment.toUpperCase() : segment;
      }
    }
  }

  if (!key) {
    if (trimmed.toLowerCase().includes("space")) {
      key = "Space";
    } else if (trimmed.toLowerCase().includes("enter")) {
      key = "Enter";
    }
  }

  if (!key && modifiers.length === 0) {
    return undefined;
  }

  const acceleratorParts = [...modifiers];
  if (key) {
    acceleratorParts.push(key);
  }

  return acceleratorParts.join("+");
}
