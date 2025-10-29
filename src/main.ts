import type { MenuItemConstructorOptions } from "electron";
import { app, BrowserWindow, Menu, Tray, nativeImage } from "electron";
import registerListeners from "./helpers/ipc/listeners-register";
// "electron-squirrel-startup" seems broken when packaging with vite
//import started from "electron-squirrel-startup";
import path from "path";
import fs from "fs";
import {
  installExtension,
  REACT_DEVELOPER_TOOLS,
} from "electron-devtools-installer";
import type { AppConfig, PlatformConfig, RuntimeConfig } from "@/types/config";
import { getConfig } from "@/helpers/ipc/config/config-store";
import type { SupportedLocale } from "@/helpers/ipc/language/language-store";
import { getPreferredLanguage } from "@/helpers/ipc/language/language-store";
import { executePlatforms } from "@/helpers/ipc/config/platform-executor";
import { getLicenseService } from "@/helpers/ipc/license/license-service";

const inDevelopment = process.env.NODE_ENV === "development";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
const licenseService = getLicenseService();

const TRAY_TRANSLATIONS: Record<
  SupportedLocale,
  { showMain: string; exit: string; enabledPlatformsHeader: string }
> = {
  en: {
    showMain: "Show Main Window",
    exit: "Quit RushMeme",
    enabledPlatformsHeader: "Enabled platforms",
  },
  "zh-CN": {
    showMain: "显示主界面",
    exit: "退出",
    enabledPlatformsHeader: "（已开启的平台）",
  },
};

function resolveTrayLocale(): SupportedLocale {
  return getPreferredLanguage(app.getLocale());
}

function getTrayLabels() {
  const locale = resolveTrayLocale();
  return TRAY_TRANSLATIONS[locale] ?? TRAY_TRANSLATIONS.en;
}

function showMainWindow() {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  if (!mainWindow.isVisible()) {
    if (process.platform === "darwin") {
      app.dock?.show();
    }
    mainWindow.show();
  }

  if (process.platform !== "darwin") {
    mainWindow.setSkipTaskbar(false);
  }

  mainWindow.focus();
}

function formatPlatformLabel(platform: PlatformConfig): string {
  const tokenType = platform.tokenType?.trim();
  if (tokenType && !tokenType.toLowerCase().includes("any")) {
    return `${platform.name} - ${platform.tokenType}`;
  }
  return platform.name;
}

function shouldDisplayPlatform(platform: PlatformConfig): boolean {
  return Boolean(platform.enabled);
}

async function executePlatform(platformId: string) {
  try {
    const currentConfig = getConfig();
    const target = currentConfig.platforms.find(
      (item) => item.id === platformId,
    );
    if (!target || !target.enabled) {
      return;
    }

    const platformOnlyConfig: AppConfig = {
      ...currentConfig,
      platforms: [target],
    };

    await executePlatforms(platformOnlyConfig);
  } catch (error) {
    console.error(`[rushmeme] tray launch for ${platformId} failed:`, error);
  }
}

function buildTrayMenuTemplate(
  config?: AppConfig | RuntimeConfig,
): MenuItemConstructorOptions[] {
  const labels = getTrayLabels();
  const effectiveConfig = config ?? getConfig();
  const enabledPlatforms = effectiveConfig.platforms.filter(
    shouldDisplayPlatform,
  );

  const template: MenuItemConstructorOptions[] = [
    {
      label: labels.showMain,
      click: () => {
        showMainWindow();
      },
    },
    { type: "separator" },
  ];

  if (enabledPlatforms.length > 0) {
    template.push({
      label: labels.enabledPlatformsHeader,
      enabled: false,
    });

    for (const platform of enabledPlatforms) {
      template.push({
        label: formatPlatformLabel(platform),
        click: () => {
          void executePlatform(platform.id);
        },
      });
    }
    template.push({ type: "separator" });
  }

  template.push({
    label: labels.exit,
    click: () => {
      isQuitting = true;
      app.quit();
    },
  });

  return template;
}

function refreshTrayMenu(config?: AppConfig | RuntimeConfig) {
  if (!tray) {
    return;
  }

  tray.setContextMenu(Menu.buildFromTemplate(buildTrayMenuTemplate(config)));
}

function buildTrayIcon() {
  const searchDirectories = Array.from(
    new Set(
      [
        path.join(process.resourcesPath, "images"),
        process.resourcesPath,
        path.join(app.getAppPath(), "images"),
        app.getAppPath(),
        path.join(process.cwd(), "images"),
        process.cwd(),
      ].filter(Boolean),
    ),
  );

  if (process.platform === "darwin") {
    const macCandidates = [
      "trayTemplate.icns",
      "trayTemplate.png",
      "trayTemplate@2x.png",
    ];

    for (const directory of searchDirectories) {
      for (const candidate of macCandidates) {
        const candidatePath = path.join(directory, candidate);
        const loaded = nativeImage.createFromPath(candidatePath);
        if (loaded.isEmpty()) {
          continue;
        }

        const sized = loaded.resize({
          width: 18,
          height: 18,
          quality: "best",
        });
        sized.setTemplateImage(true);
        return sized;
      }
    }

    console.warn(
      "[rushmeme] no mac tray icon found (trayTemplate.icns, trayTemplate.png, or trayTemplate@2x.png). Falling back to generated icon.",
    );
  }

  if (process.platform === "win32") {
    for (const directory of searchDirectories) {
      const candidate = path.join(directory, "trayTemplate.ico");
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return path.join(process.resourcesPath, "images", "trayTemplate.ico");
  }

  for (const directory of searchDirectories) {
    const linuxIconPath = path.join(directory, "trayTemplate.png");
    const linuxImage = nativeImage.createFromPath(linuxIconPath);
    if (!linuxImage.isEmpty()) {
      return linuxImage;
    }
  }

  const macSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="32" viewBox="0 0 576 512"><path fill="#2563eb" d="M528 56c0-13.3-10.7-24-24-24s-24 10.7-24 24v8H32C14.3 64 0 78.3 0 96v112c0 17.7 14.3 32 32 32h10c20.8 0 36.1 19.6 31 39.8L33 440.2c-2.4 9.6-.2 19.7 5.8 27.5S54.1 480 64 480h96c14.7 0 27.5-10 31-24.2L217 352h104.4c23.7 0 44.8-14.9 52.7-37.2l26.7-74.8h31.1c8.5 0 16.6-3.4 22.6-9.4l22.6-22.6h66.7c17.7 0 32-14.3 32-32V96c0-17.7-14.3-32-32-32h-16v-8zM321.4 304h-92.5l16-64h105l-21 58.7c-1.1 3.2-4.2 5.3-7.5 5.3M80 128h384c8.8 0 16 7.2 16 16s-7.2 16-16 16H80c-8.8 0-16-7.2-16-16s7.2-16 16-16"/></svg>`;
  const defaultSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="32" viewBox="0 0 576 512"><path fill="#2563eb" d="M528 56c0-13.3-10.7-24-24-24s-24 10.7-24 24v8H32C14.3 64 0 78.3 0 96v112c0 17.7 14.3 32 32 32h10c20.8 0 36.1 19.6 31 39.8L33 440.2c-2.4 9.6-.2 19.7 5.8 27.5S54.1 480 64 480h96c14.7 0 27.5-10 31-24.2L217 352h104.4c23.7 0 44.8-14.9 52.7-37.2l26.7-74.8h31.1c8.5 0 16.6-3.4 22.6-9.4l22.6-22.6h66.7c17.7 0 32-14.3 32-32V96c0-17.7-14.3-32-32-32h-16v-8zM321.4 304h-92.5l16-64h105l-21 58.7c-1.1 3.2-4.2 5.3-7.5 5.3M80 128h384c8.8 0 16 7.2 16 16s-7.2 16-16 16H80c-8.8 0-16-7.2-16-16s7.2-16 16-16"/></svg>`;
  const iconSvg = process.platform === "darwin" ? macSvg : defaultSvg;
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(iconSvg).toString("base64")}`;
  const icon = nativeImage.createFromDataURL(dataUrl);
  const targetSize = process.platform === "darwin" ? 18 : 24;

  if (process.platform === "darwin") {
    const sized = icon.resize({
      width: targetSize,
      height: targetSize,
      quality: "best",
    });
    sized.setTemplateImage(true);
    return sized;
  }

  return icon.resize({
    width: targetSize,
    height: targetSize,
    quality: "best",
  });
}

function createTray() {
  if (tray) {
    return;
  }

  const trayIcon = buildTrayIcon();

  tray = new Tray(trayIcon);
  tray.setToolTip(app.getName());
  refreshTrayMenu();

  tray.on("click", () => {
    tray?.popUpContextMenu();
  });
}

function createWindow() {
  const preload = path.join(__dirname, "preload.js");
  const isDev = !app.isPackaged;
  const basePath = isDev ? app.getAppPath() : process.resourcesPath;
  const iconPath =
    process.platform === "darwin"
      ? path.join(basePath, "images/icon.icns")
      : path.join(basePath, "images/icon.png");

  const window = new BrowserWindow({
    width: 960,
    height: 800,
    icon: iconPath,
    webPreferences: {
      devTools: inDevelopment,
      contextIsolation: true,
      nodeIntegration: true,
      nodeIntegrationInSubFrames: false,
      preload: preload,
    },
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    trafficLightPosition:
      process.platform === "darwin" ? { x: 5, y: 5 } : undefined,
  });

  mainWindow = window;
  registerListeners(window, {
    onConfigUpdated: (config) => {
      refreshTrayMenu(config);
    },
    onLanguageChanged: () => {
      refreshTrayMenu();
    },
  });

  window.on("close", (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    window.hide();
    if (process.platform === "darwin") {
      app.dock?.hide();
    } else {
      window.setSkipTaskbar(true);
    }
  });

  window.on("show", () => {
    if (process.platform === "darwin") {
      app.dock?.show();
    } else {
      window.setSkipTaskbar(false);
    }
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    window.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
}

async function installExtensions() {
  try {
    const result = await installExtension(REACT_DEVELOPER_TOOLS);
    console.log(`Extensions installed successfully: ${result.name}`);
  } catch {
    console.error("Failed to install extensions");
  }
}

app.on("before-quit", () => {
  isQuitting = true;
  licenseService.shutdown();
});

app.whenReady().then(async () => {
  createWindow();
  createTray();
  void licenseService.initialize();
  await installExtensions();
});

//osX only
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
//osX only ends
