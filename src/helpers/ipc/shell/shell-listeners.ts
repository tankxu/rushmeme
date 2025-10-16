import { ipcMain, shell } from "electron";
import { SHELL_OPEN_EXTERNAL_CHANNEL } from "./shell-channels";

export function addShellEventListeners() {
  ipcMain.handle(SHELL_OPEN_EXTERNAL_CHANNEL, async (_event, url: string) => {
    await shell.openExternal(url);
  });
}
