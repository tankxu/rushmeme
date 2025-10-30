import { setTimeout as delay } from "timers/promises";

const LICENSE_SERVICE_BASE_URL = "https://license-worker.tankxu.workers.dev";
const API_PREFIX = "/v1";
const REQUEST_TIMEOUT_MS = 10_000;

type LicenseWorkerErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
  status?: string;
  message?: string;
  [key: string]: unknown;
};

export type LicenseWorkerActivationResponse = {
  status?: string;
  allowed?: boolean;
  remaining_slots?: number;
  remainingActivations?: number;
  expires_at?: string;
  expiresAt?: string;
  next_check_in?: number;
  nextCheckIn?: number;
  activation?: {
    id?: string;
    device_id?: string;
    deviceId?: string;
    device_name?: string;
    deviceName?: string;
  };
  license?: {
    status?: string;
    expires_at?: string;
    expiresAt?: string;
    issued_to?: string;
    issuedTo?: string;
  };
  [key: string]: unknown;
};

export type LicenseWorkerValidationResponse = LicenseWorkerActivationResponse & {
  allowed?: boolean;
};

export type LicenseWorkerActivationListResponse = {
  data?: Array<{
    id?: string;
    device_id?: string;
    deviceId?: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: unknown;
  }>;
  remaining_slots?: number;
  remainingActivations?: number;
  [key: string]: unknown;
};

export type LicenseApiSuccess<T> = {
  ok: true;
  status: number;
  data: T;
  headers: Headers;
};

export type LicenseApiFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
  retryable: boolean;
  payload?: unknown;
};

export type LicenseApiResult<T> = LicenseApiSuccess<T> | LicenseApiFailure;

export type LicenseActivationRequest = {
  licenseKey: string;
  deviceId: string;
  deviceName?: string;
  platform?: string | null;
  osVersion?: string | null;
  appVersion?: string | null;
};

export type LicenseValidationRequest = {
  licenseKey: string;
  deviceId: string;
  platform?: string | null;
  osVersion?: string | null;
  appVersion?: string | null;
};

export type LicenseDeactivationRequest = {
  licenseKey: string;
  deviceId: string;
};

export type LicenseActivationListRequest = {
  licenseKey: string;
};

type LicenseClientOptions = {
  baseUrl?: string;
  apiKey?: string | null;
};

export class LicenseApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | null;

  constructor(options?: LicenseClientOptions) {
    this.baseUrl = (options?.baseUrl ?? LICENSE_SERVICE_BASE_URL).replace(/\/+$/, "");
    const apiKeyCandidate = options?.apiKey ?? null;
    this.apiKey = apiKeyCandidate ? apiKeyCandidate.trim() || null : null;
  }

  async activate(
    request: LicenseActivationRequest,
  ): Promise<LicenseApiResult<LicenseWorkerActivationResponse>> {
    const body: Record<string, unknown> = {
      device_id: request.deviceId,
      device_name: request.deviceName,
    };

    if (request.platform) {
      body.platform = request.platform;
    }

    if (request.osVersion) {
      body.os_version = request.osVersion;
    }

    if (request.appVersion) {
      body.app_version = request.appVersion;
    }

    console.debug("[rushmeme] license.activate payload", body);

    return this.call<LicenseWorkerActivationResponse>(
      `/licenses/${encodeURIComponent(request.licenseKey)}/activations`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      request.licenseKey,
    );
  }

  async validate(
    request: LicenseValidationRequest,
  ): Promise<LicenseApiResult<LicenseWorkerValidationResponse>> {
    const body: Record<string, unknown> = {
      device_id: request.deviceId,
    };

    if (request.platform) {
      body.platform = request.platform;
    }

    if (request.osVersion) {
      body.os_version = request.osVersion;
    }

    if (request.appVersion) {
      body.app_version = request.appVersion;
    }

    console.debug("[rushmeme] license.validate payload", body);

    return this.call<LicenseWorkerValidationResponse>(
      `/licenses/${encodeURIComponent(request.licenseKey)}/validate`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      request.licenseKey,
    );
  }

  async listActivations(
    request: LicenseActivationListRequest,
  ): Promise<LicenseApiResult<LicenseWorkerActivationListResponse>> {
    return this.call<LicenseWorkerActivationListResponse>(
      `/licenses/${encodeURIComponent(request.licenseKey)}/activations`,
      {
        method: "GET",
      },
      request.licenseKey,
    );
  }

  async deactivate(
    request: LicenseDeactivationRequest,
  ): Promise<LicenseApiResult<Record<string, unknown>>> {
    return this.call<Record<string, unknown>>(
      `/licenses/${encodeURIComponent(request.licenseKey)}/activations/${encodeURIComponent(request.deviceId)}/deactivate`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
      request.licenseKey,
    );
  }

  private async call<T>(
    path: string,
    init: RequestInit,
    licenseKey: string,
  ): Promise<LicenseApiResult<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const url = `${this.baseUrl}${API_PREFIX}${path}`;
      const headers = new Headers(init.headers ?? {});
      headers.set("Content-Type", "application/json");
      headers.set("Cache-Control", "no-store");
      headers.set("x-license-key", licenseKey);
      if (this.apiKey) {
        headers.set("x-api-key", this.apiKey);
      }

      const response = await fetch(url, {
        ...init,
        headers,
        signal: controller.signal,
      });

      const status = response.status;
      const text = await response.text();
      const payload = text.length ? safeJsonParse(text) : {};

      if (!response.ok) {
        const { code, message } = extractError(payload);
        return {
          ok: false,
          status,
          code,
          message,
          retryable: status >= 500 || status === 429,
          payload,
        };
      }

      return {
        ok: true,
        status,
        data: payload as T,
        headers: response.headers,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown network error";
      return {
        ok: false,
        status: 0,
        code: "network_error",
        message,
        retryable: true,
      };
    } finally {
      clearTimeout(timeout);
      // ensure event loop not starved if repeatedly called
      await delay(0);
    }
  }
}

function extractError(payload: unknown): { code: string; message: string } {
  let code: string | null = null;
  let message: string | null = null;

  if (payload && typeof payload === "object") {
    const errorPayload = payload as LicenseWorkerErrorPayload;
    const errorDetails =
      typeof errorPayload.error === "object" && errorPayload.error
        ? errorPayload.error
        : null;

    if (errorDetails) {
      if (typeof (errorDetails as { code?: unknown }).code === "string") {
        code = (errorDetails as { code: string }).code;
      }
      if (
        typeof (errorDetails as { message?: unknown }).message === "string"
      ) {
        message = (errorDetails as { message: string }).message;
      }
    }

    if (!code) {
      const normalized = normalizeStatus(errorPayload.status);
      if (normalized) {
        code = normalized;
      }
    }

    if (!message && typeof errorPayload.message === "string") {
      message = errorPayload.message;
    }
  }

  return {
    code: code ?? "license_error",
    message: message ?? "License operation failed",
  };
}

function normalizeStatus(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

let sharedClient: LicenseApiClient | null = null;

export function getLicenseApiClient(): LicenseApiClient {
  if (!sharedClient) {
    sharedClient = new LicenseApiClient();
  }
  return sharedClient;
}
