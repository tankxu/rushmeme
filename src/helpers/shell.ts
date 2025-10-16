export async function openExternalLink(url: string) {
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
