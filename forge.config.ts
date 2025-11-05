import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "path";

const runCodesign = (appPath: string) =>
  new Promise<void>((resolve, reject) => {
    const sign = spawn(
      "codesign",
      ["--force", "--timestamp=none", "--deep", "-s", "-", appPath],
      { stdio: "inherit" },
    );

    sign.on("error", reject);
    sign.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`codesign failed for ${appPath} (exit ${code})`));
      }
    });
  });

const findAppBundle = async (outputPath: string) => {
  if (outputPath.endsWith(".app")) {
    return outputPath;
  }

  let entries;

  try {
    entries = await readdir(outputPath, { withFileTypes: true });
  } catch {
    return null;
  }

  const appDir = entries.find(
    (entry) => entry.isDirectory() && entry.name.endsWith(".app"),
  );

  return appDir ? path.join(outputPath, appDir.name) : null;
};

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: path.resolve(__dirname, "images/icon"),
    extraResource: [path.resolve(__dirname, "images")],
    appBundleId: "com.tankxu.rushmeme",
    extendInfo: {
      NSAppleEventsUsageDescription:
        "Rush Meme uses automation to copy your selection and open the correct trading platform.",
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ["darwin", "win32"]),
    new MakerDMG({
      format: "ULFO",
    }),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/main.ts",
          config: "vite.main.config.mts",
          target: "main",
        },
        {
          entry: "src/preload.ts",
          config: "vite.preload.config.mts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.mts",
        },
      ],
    }),

    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  hooks: {
    postPackage: async (_, { platform, outputPaths }) => {
      if (platform !== "darwin") {
        return;
      }

      for (const outputPath of outputPaths) {
        const appBundle = await findAppBundle(outputPath);

        if (!appBundle) {
          continue;
        }

        await runCodesign(appBundle);
      }
    },
  },
};

export default config;
