import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { createHash, randomBytes } from "crypto";
import type { LicenseSnapshot } from "@/types/config";
import { createDefaultLicenseSnapshot } from "@/config/default-config";
import { getDeviceFingerprint } from "@/helpers/device-fingerprint";

const LICENSE_STATUSES = new Set<LicenseSnapshot["status"]>([
  "unknown",
  "missing",
  "pending",
  "active",
  "suspended",
  "revoked",
  "blocked",
  "expired",
  "error",
]);

type StoredLicenseSnapshot = Omit<LicenseSnapshot, "deviceId">;

type PersistedLicensePayload = {
  data: StoredLicenseSnapshot;
  signature: string;
};

function createDefaultStoredSnapshot(): StoredLicenseSnapshot {
  const defaults = createDefaultLicenseSnapshot();
  return {
    key: defaults.key,
    status: defaults.status,
    deviceName: defaults.deviceName,
    issuedTo: defaults.issuedTo,
    expiresAt: defaults.expiresAt,
    lastValidatedAt: defaults.lastValidatedAt,
    nextCheckInAt: defaults.nextCheckInAt,
    remainingActivations: defaults.remainingActivations,
    lastErrorCode: defaults.lastErrorCode,
    lastErrorMessage: defaults.lastErrorMessage,
  };
}

function getLicenseFilePath(): string {
  const userData = app.getPath("userData");
  return join(userData, "license.dat");
}

function getLicenseSecretPath(): string {
  const userData = app.getPath("userData");
  return join(userData, "license.secret");
}

let cachedSecret: string | null = null;

function getPersistenceSecret(): string {
  if (cachedSecret) {
    return cachedSecret;
  }

  const secretPath = getLicenseSecretPath();
  if (existsSync(secretPath)) {
    try {
      const existing = readFileSync(secretPath, "utf8").trim();
      if (existing.length >= 32) {
        cachedSecret = existing;
        return cachedSecret;
      }
    } catch {
      // fall through to regenerate
    }
  }

  const generated = randomBytes(32).toString("hex");
  ensureDirectory(secretPath);
  try {
    writeFileSync(secretPath, generated, { encoding: "utf8", mode: 0o600, flag: "w" });
  } catch {
    // ignore errors; fallback to in-memory secret
  }
  cachedSecret = generated;
  return cachedSecret;
}

function computeSnapshotSignature(snapshot: StoredLicenseSnapshot): string {
  const secret = getPersistenceSecret();
  const hash = createHash("sha256");
  hash.update(secret);
  const orderedKeys = Object.keys(snapshot).sort();
  hash.update(
    "|" +
      JSON.stringify(
        snapshot,
        orderedKeys,
      ),
  );
  return hash.digest("hex");
}

function readStoredLicense(): StoredLicenseSnapshot | null {
  const filePath = getLicenseFilePath();
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as
      | PersistedLicensePayload
      | Partial<StoredLicenseSnapshot>;

    if (
      parsed &&
      typeof parsed === "object" &&
      "data" in parsed &&
      parsed.data &&
      typeof parsed.signature === "string"
    ) {
      const candidate = normalizePersistedSnapshot(parsed.data);
      if (!candidate) {
        return null;
      }
      const expected = computeSnapshotSignature(candidate);
      if (parsed.signature !== expected) {
        console.warn("[rushmeme] license snapshot signature mismatch; ignoring stored data");
        return null;
      }
      return candidate;
    }

    const candidate = normalizePersistedSnapshot(parsed as Partial<StoredLicenseSnapshot>);
    if (!candidate) {
      return null;
    }
    const signature = computeSnapshotSignature(candidate);
    try {
      ensureDirectory(filePath);
      writeFileSync(filePath, JSON.stringify({ data: candidate, signature }, null, 2), "utf8");
    } catch {
      // ignore
    }
    return candidate;
  } catch (error) {
    console.warn("[rushmeme] Failed to read license snapshot, treating as missing:", error);
    try {
      unlinkSync(filePath);
    } catch {
      // ignore unlink errors
    }
    return null;
  }
}

function normalizePersistedSnapshot(
  candidate: Partial<StoredLicenseSnapshot> | null,
): StoredLicenseSnapshot | null {
  if (!candidate) {
    return null;
  }

  const defaults = createDefaultStoredSnapshot();
  const statusCandidate = candidate.status;
  const status = LICENSE_STATUSES.has(
    (statusCandidate ?? defaults.status) as LicenseSnapshot["status"],
  )
    ? ((statusCandidate ?? defaults.status) as LicenseSnapshot["status"])
    : defaults.status;

  return {
    key: coerceNullableString(candidate.key, defaults.key),
    status,
    deviceName: coerceNullableString(candidate.deviceName, defaults.deviceName),
    issuedTo: coerceNullableString(candidate.issuedTo, defaults.issuedTo),
    expiresAt: coerceNullableString(candidate.expiresAt, defaults.expiresAt),
    lastValidatedAt: coerceNullableString(
      candidate.lastValidatedAt,
      defaults.lastValidatedAt,
    ),
    nextCheckInAt: coerceNullableString(candidate.nextCheckInAt, defaults.nextCheckInAt),
    remainingActivations: normalizeNumber(
      candidate.remainingActivations,
      defaults.remainingActivations,
    ),
    lastErrorCode: coerceNullableString(candidate.lastErrorCode, defaults.lastErrorCode),
    lastErrorMessage: coerceNullableString(
      candidate.lastErrorMessage,
      defaults.lastErrorMessage,
    ),
  };
}

function coerceNullableString(
  value: unknown,
  fallback: string | null,
): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
    return null;
  }
  if (value == null) {
    return null;
  }
  return fallback;
}

function normalizeNumber(
  value: unknown,
  fallback: number | null,
): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return fallback ?? null;
}

function ensureDirectory(filePath: string) {
  const directory = dirname(filePath);
  mkdirSync(directory, { recursive: true });
}

function shouldPersist(snapshot: StoredLicenseSnapshot): boolean {
  return Boolean(snapshot.key);
}

function normalizeRuntimeSnapshot(
  persisted: StoredLicenseSnapshot | null,
): LicenseSnapshot {
  const defaults = createDefaultLicenseSnapshot();
  const fingerprint = getDeviceFingerprint();
  const merged: StoredLicenseSnapshot =
    persisted ??
    {
      ...createDefaultStoredSnapshot(),
      status: "missing",
      key: null,
    };

  return {
    ...defaults,
    ...merged,
    status: merged.status ?? "missing",
    deviceId: fingerprint,
  };
}

export function getLicenseSnapshot(): LicenseSnapshot {
  const persisted = readStoredLicense();
  return normalizeRuntimeSnapshot(persisted);
}

export function setLicenseSnapshot(
  snapshot: LicenseSnapshot,
): LicenseSnapshot {
  const { deviceId: _ignored, ...rest } = snapshot;
  const candidateStored = normalizePersistedSnapshot(rest);
  const normalized = normalizeRuntimeSnapshot(candidateStored);
  const filePath = getLicenseFilePath();

  if (!candidateStored || !shouldPersist(candidateStored)) {
    if (existsSync(filePath)) {
      try {
        unlinkSync(filePath);
      } catch {
        // ignore unlink errors
      }
    }
    return normalized;
  }

  ensureDirectory(filePath);
  try {
    const payload: PersistedLicensePayload = {
      data: candidateStored,
      signature: computeSnapshotSignature(candidateStored),
    };
    writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
  } catch (error) {
    console.error("[rushmeme] Failed to write license snapshot:", error);
  }

  return normalized;
}

export function updateLicenseSnapshot(
  updater: (current: LicenseSnapshot) => LicenseSnapshot,
): LicenseSnapshot {
  const current = getLicenseSnapshot();
  const updated = updater(current);
  return setLicenseSnapshot(updated);
}

export function patchLicenseSnapshot(
  patch: Partial<LicenseSnapshot>,
): LicenseSnapshot {
  return updateLicenseSnapshot((current) => ({
    ...current,
    ...patch,
  }));
}
