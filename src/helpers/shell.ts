import { isSafeExternalUrl } from "@/utils/external-url";

export async function openExternalLink(url: string) {
  if (!isSafeExternalUrl(url)) {
    console.warn("[rushmeme] Refused to open an unsafe external URL");
    return;
  }

  const shellBridge = window?.electronShell;

  if (shellBridge?.openExternal) {
    try {
      await shellBridge.openExternal(url);
      return;
    } catch (error) {
      console.warn("[rushmeme] Failed to open external link via shell", error);
    }
  }

  window.open(url, "_blank", "noopener,noreferrer");
}
