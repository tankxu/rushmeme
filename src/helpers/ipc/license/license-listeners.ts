import { ipcMain, webContents } from "electron";
import type { LicenseSnapshot } from "@/types/config";
import {
  LICENSE_ACTIVATE_CHANNEL,
  LICENSE_DEACTIVATE_CHANNEL,
  LICENSE_FETCH_ACTIVATIONS_CHANNEL,
  LICENSE_GET_STATUS_CHANNEL,
  LICENSE_UPDATED_EVENT_CHANNEL,
  LICENSE_VALIDATE_CHANNEL,
  LICENSE_WATCH_CHANNEL,
} from "./license-channels";
import { getLicenseService } from "./license-service";

const subscribers = new Set<number>();

function broadcastSnapshot(snapshot: LicenseSnapshot) {
  for (const id of Array.from(subscribers)) {
    const contents = webContents.fromId(id);
    if (!contents || contents.isDestroyed()) {
      subscribers.delete(id);
      continue;
    }
    contents.send(LICENSE_UPDATED_EVENT_CHANNEL, snapshot);
  }
}

export function addLicenseEventListeners() {
  const service = getLicenseService();

  ipcMain.handle(LICENSE_GET_STATUS_CHANNEL, () => service.getSnapshot());

  ipcMain.handle(LICENSE_ACTIVATE_CHANNEL, (_event, key: string) =>
    service.activate(key, { deviceName: undefined }),
  );

  ipcMain.handle(LICENSE_VALIDATE_CHANNEL, () => service.validate());

  ipcMain.handle(LICENSE_DEACTIVATE_CHANNEL, () => service.deactivate());

  ipcMain.handle(LICENSE_FETCH_ACTIVATIONS_CHANNEL, () =>
    service.fetchActivationSummary(),
  );

  ipcMain.handle(LICENSE_WATCH_CHANNEL, (event) => {
    const contentsId = event.sender.id;
    subscribers.add(contentsId);
    event.sender.once("destroyed", () => {
      subscribers.delete(contentsId);
    });
    return service.getSnapshot();
  });

  service.on("change", broadcastSnapshot);
}
