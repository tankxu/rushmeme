let cachedStatus: boolean | null = null;

const TRUTHY_FLAGS = new Set(["1", "true", "yes", "pro", "enabled"]);
const FALSY_FLAGS = new Set(["0", "false", "no", "disabled"]);

function readEnvironmentFlag(): boolean | null {
  const candidates = [
    process.env.RUSHMEME_PRO,
    process.env.RUSHMEME_IS_PRO,
    process.env.RUSHMEME_LICENSE_TIER,
  ];

  for (const value of candidates) {
    if (typeof value !== "string") {
      continue;
    }

    const normalized = value.trim().toLowerCase();
    if (TRUTHY_FLAGS.has(normalized)) {
      return true;
    }
    if (FALSY_FLAGS.has(normalized) || normalized.length > 0) {
      return false;
    }
  }

  return null;
}

const ENVIRONMENT_OVERRIDE = readEnvironmentFlag();

function applyGlobalProFlag(value: boolean) {
  if (typeof globalThis === "object") {
    (globalThis as Record<string, unknown>).__RUSHMEME_PRO__ = value;
  }
}

export function setProLicensed(value: boolean): boolean {
  if (ENVIRONMENT_OVERRIDE !== null) {
    cachedStatus = ENVIRONMENT_OVERRIDE;
    applyGlobalProFlag(cachedStatus);
    return cachedStatus;
  }

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

  if (ENVIRONMENT_OVERRIDE !== null) {
    cachedStatus = ENVIRONMENT_OVERRIDE;
    applyGlobalProFlag(cachedStatus);
    return cachedStatus;
  }

  cachedStatus = false;
  applyGlobalProFlag(cachedStatus);
  return cachedStatus;
}
