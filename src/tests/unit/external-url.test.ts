import { describe, expect, test } from "vitest";
import { assertSafeExternalUrl, isSafeExternalUrl } from "@/utils/external-url";

describe("external URL validation", () => {
  test.each([
    "https://github.com/tankxu/rushmeme",
    "http://localhost:3000/path",
  ])("allows HTTP(S) URLs: %s", (url) => {
    expect(isSafeExternalUrl(url)).toBe(true);
    expect(() => assertSafeExternalUrl(url)).not.toThrow();
  });

  test.each([
    "javascript:alert(1)",
    "file:///etc/passwd",
    "rushmeme://open",
    "https://user:password@example.com",
    "not a url",
    "",
  ])("rejects unsafe URLs: %s", (url) => {
    expect(isSafeExternalUrl(url)).toBe(false);
    expect(() => assertSafeExternalUrl(url)).toThrow();
  });
});
