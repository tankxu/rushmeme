import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";
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

function readStoredLicense(): StoredLicenseSnapshot | null {
  const filePath = getLicenseFilePath();
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoredLicenseSnapshot>;
    return normalizePersistedSnapshot(parsed);
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

function serializeForPersistence(snapshot: LicenseSnapshot): StoredLicenseSnapshot {
  const { deviceId: _ignored, ...rest } = snapshot;
  return rest;
}

function shouldPersist(snapshot: StoredLicenseSnapshot): boolean {
  return Boolean(snapshot.key) && snapshot.status === "active";
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
  const candidateStored = normalizePersistedSnapshot(serializeForPersistence(snapshot));
  const normalized = normalizeRuntimeSnapshot(candidateStored);
  const persisted = candidateStored;
  const filePath = getLicenseFilePath();

  if (!persisted || !shouldPersist(persisted)) {
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
    writeFileSync(filePath, JSON.stringify(persisted, null, 2), "utf8");
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
