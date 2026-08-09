const ALLOWED_EXTERNAL_PROTOCOLS = new Set(["http:", "https:"]);

export function isSafeExternalUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return (
      ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol) &&
      Boolean(parsed.hostname) &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

export function assertSafeExternalUrl(value: unknown): asserts value is string {
  if (!isSafeExternalUrl(value)) {
    throw new Error("Only valid HTTP(S) external URLs are allowed.");
  }
}
