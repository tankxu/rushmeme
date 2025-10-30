let cachedStatus: boolean | null = null;

function applyGlobalProFlag(value: boolean) {
  if (typeof globalThis === "object") {
    (globalThis as Record<string, unknown>).__RUSHMEME_PRO__ = value;
  }
}

export function setProLicensed(value: boolean): boolean {
  cachedStatus = value;
  applyGlobalProFlag(cachedStatus);
  return cachedStatus;
}

export function isProLicensed(): boolean {
  if (cachedStatus !== null) {
    return cachedStatus;
  }

  if (typeof globalThis === "object") {
    const globalFlag = (globalThis as Record<string, unknown>).__RUSHMEME_PRO__;
    if (typeof globalFlag === "boolean") {
      cachedStatus = globalFlag;
      return cachedStatus;
    }
  }

  cachedStatus = false;
  applyGlobalProFlag(cachedStatus);
  return cachedStatus;
}
