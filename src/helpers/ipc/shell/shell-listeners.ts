import { ipcMain, shell } from "electron";
import { SHELL_OPEN_EXTERNAL_CHANNEL } from "./shell-channels";
import { assertSafeExternalUrl } from "@/utils/external-url";

export function addShellEventListeners() {
  ipcMain.handle(SHELL_OPEN_EXTERNAL_CHANNEL, async (_event, url: unknown) => {
    assertSafeExternalUrl(url);
    await shell.openExternal(url);
  });
}
