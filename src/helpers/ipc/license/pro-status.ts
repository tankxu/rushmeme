let cachedStatus: boolean | null = null;

const TRUTHY_FLAGS = new Set(["1", "true", "yes", "pro", "enabled"]);

function readEnvironmentFlag(): boolean | null {
  const candidates = [
    process.env.RUSHMEME_PRO,
    process.env.RUSHMEME_IS_PRO,
    process.env.RUSHMEME_LICENSE_TIER,
  ];

  for (const value of candidates) {
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (TRUTHY_FLAGS.has(normalized)) {
        return true;
      }
      if (normalized.length > 0) {
        return false;
      }
    }
  }

  return null;
}

export function isProLicensed(): boolean {
  if (typeof globalThis === "object") {
    const globalFlag = (globalThis as Record<string, unknown>).__RUSHMEME_PRO__;
    if (typeof globalFlag === "boolean") {
      cachedStatus = globalFlag;
      return cachedStatus;
    }
  }

  if (cachedStatus !== null) {
    return cachedStatus;
  }

  const envFlag = readEnvironmentFlag();
  if (envFlag !== null) {
    cachedStatus = envFlag;
    return cachedStatus;
  }

  cachedStatus = false;
  return cachedStatus;
}
