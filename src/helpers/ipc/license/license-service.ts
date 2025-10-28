import { setTimeout as delay } from "timers/promises";
import { EventEmitter } from "events";
import os from "os";
import { app } from "electron";
import type { LicenseSnapshot, LicenseStatus } from "@/types/config";
import { getLicenseSnapshot, updateLicenseSnapshot } from "./license-store";
import {
  getLicenseApiClient,
  LicenseActivationRequest,
  LicenseWorkerActivationListResponse,
  LicenseWorkerActivationResponse,
  LicenseWorkerValidationResponse,
} from "./license-client";
import { setProLicensed } from "./pro-status";

export type LicenseOperationResult = {
  success: boolean;
  snapshot: LicenseSnapshot;
  code?: string;
  message?: string;
  retryable?: boolean;
  statusCode?: number;
  raw?: unknown;
};

export type LicenseActivationSummary = {
  activations: Array<{
    id: string;
    deviceId: string;
    createdAt?: string | null;
    updatedAt?: string | null;
  }>;
  remainingActivations: number | null;
};

type LicenseServiceEvents = {
  change: (snapshot: LicenseSnapshot) => void;
  "heartbeat-error": (details: { code: string; message: string }) => void;
};

type EventKey = keyof LicenseServiceEvents;

const DEFAULT_HEARTBEAT_INTERVAL_MS = 86_400_000; // 24h
const HEARTBEAT_BACKOFF_STEPS_MS = [15_000, 60_000, 300_000, 900_000, 1_800_000];

const ERROR_STATUS_MAP: Record<string, LicenseStatus> = {
  missing_license_key: "missing",
  invalid_license_key: "missing",
  license_revoked: "revoked",
  license_suspended: "suspended",
  activation_limit_reached: "blocked",
  activation_required: "pending",
  activation_blocked: "blocked",
  activation_not_found: "missing",
  rate_limited: "error",
};

function isActiveStatus(status: LicenseStatus): boolean {
  return status === "active";
}

type LicenseEnvironmentMeta = {
  platform?: string | null;
  osVersion?: string | null;
  appVersion?: string | null;
};

function resolvePlatformTag(): string {
  switch (process.platform) {
    case "win32":
      return "win";
    case "darwin":
      return "mac";
    case "linux":
      return "linux";
    default:
      return process.platform;
  }
}

function resolveOsVersion(): string | null {
  try {
    const getSystemVersion = (process as unknown as {
      getSystemVersion?: () => string;
    }).getSystemVersion;
    if (typeof getSystemVersion === "function") {
      const version = getSystemVersion();
      if (version && version.trim().length > 0) {
        return version.trim();
      }
    }
  } catch {
    // ignore
  }

  try {
    const osVersionFn = (os as unknown as { version?: () => string }).version;
    if (typeof osVersionFn === "function") {
      const version = osVersionFn();
      if (version && version.trim().length > 0) {
        return version.trim();
      }
    }
  } catch {
    // ignore
  }

  try {
    const release = os.release();
    return release?.trim() || null;
  } catch {
    return null;
  }
}

function resolveAppVersion(): string | null {
  try {
    const version = app.getVersion();
    return version?.trim() || null;
  } catch {
    return null;
  }
}

function resolveEnvironmentMeta(): LicenseEnvironmentMeta {
  const platform = resolvePlatformTag();
  const osVersion = resolveOsVersion();
  const appVersion = resolveAppVersion();

  return {
    platform,
    osVersion,
    appVersion,
  };
}

function resolveDeviceName(): string {
  try {
    const hostname = os.hostname();
    if (hostname && hostname.trim().length > 0) {
      return hostname;
    }
  } catch {
    // ignore
  }
  return "RushMeme";
}

function normalizeLicenseKey(key: string): string {
  return key.trim();
}

function deriveLicenseStatus(
  responseStatus: string | null,
  allowed?: boolean | null,
  errorCode?: string | null,
): LicenseStatus {
  if (allowed === true) {
    return "active";
  }

  const normalizedStatus = responseStatus?.trim().toLowerCase() ?? null;
  if (normalizedStatus) {
    switch (normalizedStatus) {
      case "active":
      case "activated":
        return "active";
      case "revoked":
        return "revoked";
      case "suspended":
        return "suspended";
      case "blocked":
      case "denied":
        return "blocked";
      case "pending":
      case "activation_required":
        return "pending";
      case "expired":
        return "expired";
      default:
        break;
    }
  }

  if (allowed === false) {
    return "blocked";
  }

  if (errorCode) {
    const mapped = ERROR_STATUS_MAP[errorCode];
    if (mapped) {
      return mapped;
    }
  }

  return "error";
}

function extractNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function extractString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return null;
}

function getRemainingActivations(
  payload:
    | LicenseWorkerActivationResponse
    | LicenseWorkerValidationResponse
    | LicenseWorkerActivationListResponse
    | undefined,
): number | null {
  if (!payload) {
    return null;
  }

  const direct =
    extractNumber(
      (payload as LicenseWorkerActivationResponse).remainingActivations,
    ) ??
    extractNumber(
      (payload as LicenseWorkerActivationResponse).remaining_slots,
    ) ??
    extractNumber(
      (payload as LicenseWorkerActivationListResponse).remainingActivations,
    ) ??
    extractNumber(
      (payload as LicenseWorkerActivationListResponse).remaining_slots,
    );

  if (direct !== null) {
    return Math.max(0, Math.floor(direct));
  }

  return null;
}

function getNextCheckInSeconds(
  payload: LicenseWorkerActivationResponse | LicenseWorkerValidationResponse,
): number | null {
  const candidate =
    extractNumber(payload.nextCheckIn) ??
    extractNumber(payload.next_check_in);
  if (candidate !== null && candidate >= 0) {
    return candidate;
  }
  return null;
}

function deriveNextCheckInAt(seconds: number | null): string | null {
  if (seconds === null) {
    return null;
  }
  const target = Date.now() + seconds * 1000;
  return new Date(target).toISOString();
}

function extractDeviceIdFromActivation(
  payload: LicenseWorkerActivationResponse | LicenseWorkerValidationResponse,
): string | null {
  const activation = payload.activation;
  if (activation && typeof activation === "object") {
    return (
      extractString(activation.deviceId) ?? extractString(activation.device_id)
    );
  }
  return null;
}

function extractDeviceNameFromActivation(
  payload: LicenseWorkerActivationResponse | LicenseWorkerValidationResponse,
): string | null {
  const activation = payload.activation;
  if (activation && typeof activation === "object") {
    return (
      extractString(activation.deviceName) ??
      extractString(activation.device_name)
    );
  }
  return null;
}

function extractLicenseIssuedTo(
  payload: LicenseWorkerActivationResponse | LicenseWorkerValidationResponse,
): string | null {
  const license = payload.license;
  if (license && typeof license === "object") {
    return (
      extractString(license.issuedTo) ?? extractString(license.issued_to)
    );
  }
  return null;
}

function extractLicenseExpiresAt(
  payload: LicenseWorkerActivationResponse | LicenseWorkerValidationResponse,
): string | null {
  const license = payload.license;
  if (license && typeof license === "object") {
    return extractString(license.expires_at) ?? extractString(license.expiresAt);
  }
  return extractString(payload.expires_at);
}

export class LicenseService {
  private readonly client = getLicenseApiClient();
  private readonly emitter = new EventEmitter();
  private snapshot: LicenseSnapshot;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatBackoffIndex = 0;
  private initializing = false;
  private disposed = false;
  private readonly environment: LicenseEnvironmentMeta;

  constructor() {
    this.environment = resolveEnvironmentMeta();
    this.snapshot = getLicenseSnapshot();
    setProLicensed(isActiveStatus(this.snapshot.status));
  }

  async initialize(): Promise<LicenseOperationResult | null> {
    if (this.initializing || this.disposed) {
      return null;
    }

    this.initializing = true;
    try {
      this.snapshot = getLicenseSnapshot();
      if (!this.snapshot.deviceId) {
        this.snapshot = updateLicenseSnapshot((current) => ({
          ...current,
          deviceId: current.deviceId,
        }));
      }

      if (!this.snapshot.key) {
        setProLicensed(false);
        this.emit("change", this.snapshot);
        return {
          success: false,
          snapshot: this.snapshot,
          code: "missing_license_key",
          message: "No license key stored",
          retryable: false,
        };
      }

      if (this.snapshot.status === "active") {
        const result = await this.validate({ reason: "startup", silent: true });
        this.scheduleHeartbeatFromSnapshot(result?.snapshot ?? this.snapshot);
        return result;
      }

      const activationResult = await this.activate(this.snapshot.key, {
        deviceName: resolveDeviceName(),
        reason: "startup",
      });
      this.scheduleHeartbeatFromSnapshot(
        activationResult.snapshot ?? this.snapshot,
      );
      return activationResult;
    } finally {
      this.initializing = false;
    }
  }

  getSnapshot(): LicenseSnapshot {
    return this.snapshot;
  }

  on<TEvent extends EventKey>(event: TEvent, listener: LicenseServiceEvents[TEvent]) {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
    return () => this.off(event, listener);
  }

  off<TEvent extends EventKey>(event: TEvent, listener: LicenseServiceEvents[TEvent]) {
    this.emitter.off(event, listener as (...args: unknown[]) => void);
  }

  async activate(
    rawKey: string,
    options?: { deviceName?: string; reason?: string },
  ): Promise<LicenseOperationResult> {
    const licenseKey = normalizeLicenseKey(rawKey);
    if (!licenseKey) {
      return {
        success: false,
        snapshot: this.snapshot,
        code: "invalid_license_key",
        message: "License key is empty",
        retryable: false,
      };
    }

    const previousSnapshot = this.snapshot;
    this.snapshot = this.updateSnapshot(
      (current) => ({
        ...current,
        key: licenseKey,
        status: "pending",
        lastErrorCode: null,
        lastErrorMessage: null,
      }),
      { proLicensed: false, notify: true },
    );

    const baseDeviceName =
      options?.deviceName ?? this.snapshot.deviceName ?? resolveDeviceName();
    const deviceName = baseDeviceName.includes(this.snapshot.deviceId)
      ? baseDeviceName
      : `${baseDeviceName} (${this.snapshot.deviceId})`;

    const request: LicenseActivationRequest = {
      licenseKey,
      deviceId: this.snapshot.deviceId,
      deviceName,
      platform: this.environment.platform,
      osVersion: this.environment.osVersion,
      appVersion: this.environment.appVersion,
    };

    const response = await this.client.activate(request);
    if (!response.ok) {
      const status = ERROR_STATUS_MAP[response.code] ?? "error";
      const restored = this.updateSnapshot(
        () => ({
          ...previousSnapshot,
          lastErrorCode: response.code,
          lastErrorMessage: response.message,
          status: status === "error" ? previousSnapshot.status : status,
        }),
        { proLicensed: isActiveStatus(previousSnapshot.status), notify: true },
      );
      return {
        success: false,
        snapshot: restored,
        code: response.code,
        message: response.message,
        retryable: response.retryable,
        statusCode: response.status,
        raw: response.payload,
      };
    }

    const nextSnapshot = this.applySuccessPayload(response.data, licenseKey, {
      clearErrors: true,
      ensureActive: true,
    });
    this.scheduleHeartbeatFromSnapshot(nextSnapshot);
    return {
      success: true,
      snapshot: nextSnapshot,
    };
  }

  async validate(options?: {
    silent?: boolean;
    reason?: string;
  }): Promise<LicenseOperationResult> {
    const licenseKey = this.snapshot.key;
    if (!licenseKey) {
      const updated = this.updateSnapshot(
        (current) => ({
          ...current,
          status: "missing",
        }),
        { proLicensed: false, notify: !options?.silent },
      );
      return {
        success: false,
        snapshot: updated,
        code: "missing_license_key",
        message: "License key not set",
        retryable: false,
      };
    }

    const response = await this.client.validate({
      licenseKey,
      deviceId: this.snapshot.deviceId,
      platform: this.environment.platform,
      osVersion: this.environment.osVersion,
      appVersion: this.environment.appVersion,
    });

    const previousSnapshot = this.snapshot;
    if (!response.ok) {
      const errorStatus = ERROR_STATUS_MAP[response.code] ?? "error";
      const nextStatus = response.retryable ? previousSnapshot.status : errorStatus;
      const shouldDisablePro =
        !response.retryable && !isActiveStatus(errorStatus);
      const proOption = shouldDisablePro
        ? false
        : response.retryable
          ? undefined
          : isActiveStatus(errorStatus);
      const nextSnapshot = this.updateSnapshot(
        (current) => ({
          ...current,
          status: nextStatus,
          lastErrorCode: response.code,
          lastErrorMessage: response.message,
        }),
        { proLicensed: proOption, notify: !options?.silent },
      );
      if (!options?.silent) {
        this.emit("heartbeat-error", {
          code: response.code,
          message: response.message,
        });
      }
      return {
        success: false,
        snapshot: nextSnapshot,
        code: response.code,
        message: response.message,
        retryable: response.retryable,
        statusCode: response.status,
        raw: response.payload,
      };
    }

    const nextSnapshot = this.applySuccessPayload(response.data, licenseKey, {
      clearErrors: true,
      ensureActive: response.data.allowed === true,
      notify: !options?.silent,
    });
    return {
      success: true,
      snapshot: nextSnapshot,
    };
  }

  async deactivate(): Promise<LicenseOperationResult> {
    const licenseKey = this.snapshot.key;
    if (!licenseKey) {
      return {
        success: true,
        snapshot: this.snapshot,
      };
    }

    const deviceId = this.snapshot.deviceId;
    const response = await this.client.deactivate({
      licenseKey,
      deviceId,
    });

    if (!response.ok && response.code !== "activation_not_found") {
      const nextSnapshot = this.updateSnapshot(
        (current) => ({
          ...current,
          lastErrorCode: response.code,
          lastErrorMessage: response.message,
        }),
        { notify: true },
      );
      return {
        success: false,
        snapshot: nextSnapshot,
        code: response.code,
        message: response.message,
        retryable: response.retryable,
        statusCode: response.status,
        raw: response.payload,
      };
    }

    this.clearHeartbeat();
    const cleared = this.updateSnapshot(
      (current) => ({
        ...current,
        key: null,
        status: "missing",
        expiresAt: null,
        issuedTo: null,
        nextCheckInAt: null,
        remainingActivations: null,
        lastValidatedAt: new Date().toISOString(),
        lastErrorCode: null,
        lastErrorMessage: null,
      }),
      { proLicensed: false, notify: true },
    );

    return {
      success: true,
      snapshot: cleared,
    };
  }

  async fetchActivationSummary(): Promise<{
    snapshot: LicenseSnapshot;
    summary: LicenseActivationSummary | null;
    code?: string;
    message?: string;
    success: boolean;
  }> {
    const licenseKey = this.snapshot.key;
    if (!licenseKey) {
      return {
        success: false,
        snapshot: this.snapshot,
        summary: null,
        code: "missing_license_key",
        message: "License key not set",
      };
    }

    const response = await this.client.listActivations({ licenseKey });
    if (!response.ok) {
      const nextSnapshot = this.updateSnapshot(
        (current) => ({
          ...current,
          lastErrorCode: response.code,
          lastErrorMessage: response.message,
        }),
        { notify: false },
      );
      return {
        success: false,
        snapshot: nextSnapshot,
        summary: null,
        code: response.code,
        message: response.message,
      };
    }

    const remainingActivations = getRemainingActivations(response.data);
    const normalizedSnapshot = this.updateSnapshot(
      (current) => ({
        ...current,
        remainingActivations,
      }),
      { notify: false },
    );

    const activations: LicenseActivationSummary["activations"] =
      Array.isArray(response.data.data)
        ? response.data.data.reduce<LicenseActivationSummary["activations"]>(
            (accumulator, item) => {
              const id =
                extractString(item.id) ?? extractString(item.deviceId) ?? "";
              const deviceId =
                extractString(item.deviceId) ?? extractString(item.device_id);
              if (!id || !deviceId) {
                return accumulator;
              }

              const createdAt =
                extractString(item.created_at) ??
                extractString(item.createdAt) ??
                null;
              const updatedAt =
                extractString(item.updated_at) ??
                extractString(item.updatedAt) ??
                null;

              accumulator.push({
                id,
                deviceId,
                createdAt,
                updatedAt,
              });
              return accumulator;
            },
            [],
          )
        : [];

    return {
      success: true,
      snapshot: normalizedSnapshot,
      summary: {
        activations,
        remainingActivations,
      },
    };
  }

  shutdown() {
    this.disposed = true;
    this.clearHeartbeat();
  }

  private applySuccessPayload(
    payload: LicenseWorkerActivationResponse | LicenseWorkerValidationResponse,
    key: string,
    options?: { clearErrors?: boolean; ensureActive?: boolean; notify?: boolean },
  ): LicenseSnapshot {
    const allowed = payload.allowed ?? null;
    const payloadStatus =
      extractString(payload.status) ??
      extractString(payload.license?.status) ??
      null;
    const status = options?.ensureActive
      ? "active"
      : deriveLicenseStatus(payloadStatus, allowed);

    const nextCheckInSeconds = getNextCheckInSeconds(payload);
    const nextCheckInAt = deriveNextCheckInAt(
      nextCheckInSeconds ?? null,
    ) ?? this.snapshot.nextCheckInAt;

    const remainingActivations = getRemainingActivations(payload);
    const deviceId = extractDeviceIdFromActivation(payload) ?? this.snapshot.deviceId;
    const deviceName =
      extractDeviceNameFromActivation(payload) ?? this.snapshot.deviceName ?? resolveDeviceName();
    const issuedTo = extractLicenseIssuedTo(payload) ?? this.snapshot.issuedTo;
    const expiresAt =
      extractLicenseExpiresAt(payload) ?? this.snapshot.expiresAt;

    const updated = this.updateSnapshot(
      (current) => ({
        ...current,
        key,
        status,
        deviceId,
        deviceName,
        issuedTo,
        expiresAt,
        nextCheckInAt,
        remainingActivations,
        lastValidatedAt: new Date().toISOString(),
        lastErrorCode: options?.clearErrors ? null : current.lastErrorCode,
        lastErrorMessage: options?.clearErrors ? null : current.lastErrorMessage,
      }),
      { proLicensed: isActiveStatus(status), notify: options?.notify ?? true },
    );

    this.heartbeatBackoffIndex = 0;
    return updated;
  }

  private updateSnapshot(
    updater: (current: LicenseSnapshot) => LicenseSnapshot,
    options?: { proLicensed?: boolean; notify?: boolean },
  ): LicenseSnapshot {
    if (options?.proLicensed !== undefined) {
      setProLicensed(options.proLicensed);
    }

    this.snapshot = updateLicenseSnapshot(updater);
    if (options?.notify !== false) {
      this.emit("change", this.snapshot);
    }
    return this.snapshot;
  }

  private clearHeartbeat() {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleHeartbeat(delayMs: number) {
    this.clearHeartbeat();
    if (this.disposed) {
      return;
    }

    this.heartbeatTimer = setTimeout(() => {
      void this.runHeartbeat();
    }, delayMs);
  }

  private scheduleHeartbeatFromSnapshot(snapshot: LicenseSnapshot) {
    if (!snapshot.key) {
      this.clearHeartbeat();
      return;
    }

    const targetTime = snapshot.nextCheckInAt
      ? new Date(snapshot.nextCheckInAt).getTime()
      : Date.now() + DEFAULT_HEARTBEAT_INTERVAL_MS;

    const now = Date.now();
    const delayMs = Math.max(targetTime - now, 15_000);
    this.scheduleHeartbeat(delayMs);
  }

  private async runHeartbeat() {
    if (this.disposed) {
      return;
    }

    const result = await this.validate({ silent: true, reason: "heartbeat" });
    if (result?.success) {
      const snapshot = result.snapshot;
      const nextCheckInAt =
        snapshot.nextCheckInAt ?? deriveNextCheckInAt(86_400) ?? null;
      if (nextCheckInAt) {
        const delayMs = Math.max(
          new Date(nextCheckInAt).getTime() - Date.now(),
          60_000,
        );
        this.scheduleHeartbeat(delayMs);
      } else {
        this.scheduleHeartbeat(DEFAULT_HEARTBEAT_INTERVAL_MS);
      }
      return;
    }

    this.heartbeatBackoffIndex = Math.min(
      this.heartbeatBackoffIndex + 1,
      HEARTBEAT_BACKOFF_STEPS_MS.length - 1,
    );
    const backoffMs = HEARTBEAT_BACKOFF_STEPS_MS[this.heartbeatBackoffIndex];
    this.scheduleHeartbeat(backoffMs);
    await delay(0);
  }

  private emit<TEvent extends EventKey>(
    event: TEvent,
    payload: Parameters<LicenseServiceEvents[TEvent]>[0],
  ) {
    this.emitter.emit(event, payload);
  }
}

let singleton: LicenseService | null = null;

export function getLicenseService(): LicenseService {
  if (!singleton) {
    singleton = new LicenseService();
  }
  return singleton;
}
