function applyGlobalProFlag(value: boolean) {
  if (typeof globalThis === "object") {
    (globalThis as Record<string, unknown>).__RUSHMEME_PRO__ = value;
  }
}

export function setProLicensed(value: boolean): boolean {
  // Kept for backwards-compatible callers. Licensing no longer controls access.
  void value;
  applyGlobalProFlag(true);
  return true;
}

export function isProLicensed(): boolean {
  applyGlobalProFlag(true);
  return true;
}
