import { createHash, randomUUID } from "crypto";
import { readFileSync } from "fs";
import { execFileSync, spawnSync } from "child_process";
import os from "os";
import { createRequire } from "module";
import type { SystemPreferences } from "electron";

const requireForElectron = createRequire(import.meta.url);

type ExtendedSystemPreferences = SystemPreferences & {
  getSerialNumber?: () => string;
};

let electronSystemPreferences: ExtendedSystemPreferences | null = null;

try {
  const electron = requireForElectron("electron") as typeof import("electron");
  electronSystemPreferences = (electron.systemPreferences ??
    null) as ExtendedSystemPreferences | null;
} catch {
  electronSystemPreferences = null;
}

let cachedFingerprint: string | null = null;

function safeTrim(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return value.toString().trim();
}

function safeExecFile(command: string, args: string[]): string {
  try {
    const output = execFileSync(command, args, { encoding: "utf8" });
    return safeTrim(output);
  } catch {
    return "";
  }
}

function safeReadFile(path: string): string {
  try {
    const content = readFileSync(path, "utf8");
    return safeTrim(content);
  } catch {
    return "";
  }
}

function collectMacIdentifiers(): string[] {
  const identifiers: string[] = [];

  if (
    process.platform === "darwin" &&
    electronSystemPreferences &&
    typeof electronSystemPreferences.getSerialNumber === "function"
  ) {
    try {
      const serial = safeTrim(electronSystemPreferences.getSerialNumber());
      if (serial) {
        identifiers.push(serial);
      }
    } catch {
      // ignore
    }
  }

  const ioregOutput = safeExecFile("ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"]);
  const ioregMatch = /"IOPlatformUUID"\s*=\s*"([^"]+)"/i.exec(ioregOutput);
  if (ioregMatch?.[1]) {
    identifiers.push(safeTrim(ioregMatch[1]));
  }

  const diskutilOutput = safeExecFile("diskutil", ["info", "/"]);
  const diskMatch = /Volume UUID:\s*([0-9A-Fa-f-]+)/i.exec(diskutilOutput);
  if (diskMatch?.[1]) {
    identifiers.push(safeTrim(diskMatch[1]));
  }

  return identifiers;
}

function collectWindowsIdentifiers(): string[] {
  const identifiers: string[] = [];

  const csProductOutput = safeExecFile("wmic", ["csproduct", "get", "uuid"]);
  const csProductLines = csProductOutput
    .split(/\r?\n/)
    .map((line) => safeTrim(line))
    .filter(Boolean);
  if (csProductLines.length > 1) {
    identifiers.push(csProductLines[1]);
  }

  const machineGuidOutput = safeExecFile("reg", [
    "query",
    "HKLM\\SOFTWARE\\Microsoft\\Cryptography",
    "/v",
    "MachineGuid",
  ]);
  const machineGuidMatch =
    /MachineGuid\s+REG_[A-Z]+\s+([0-9A-Fa-f-]+)/.exec(machineGuidOutput);
  if (machineGuidMatch?.[1]) {
    identifiers.push(safeTrim(machineGuidMatch[1]));
  }

  const volumeSerialOutput = safeExecFile("wmic", [
    "logicaldisk",
    "where",
    'DeviceID="C:"',
    "get",
    "VolumeSerialNumber",
  ]);
  const volumeSerialLines = volumeSerialOutput
    .split(/\r?\n/)
    .map((line) => safeTrim(line))
    .filter(Boolean);
  if (volumeSerialLines.length > 1) {
    identifiers.push(volumeSerialLines[1]);
  }

  return identifiers;
}

function resolveRootDevice(): string {
  const dfResult = spawnSync("df", ["-P", "/"], { encoding: "utf8" });
  if (!dfResult.stdout) {
    return "";
  }

  const lines = dfResult.stdout
    .split(/\r?\n/)
    .map((line) => safeTrim(line))
    .filter(Boolean);
  if (lines.length < 2) {
    return "";
  }

  const columns = lines[1].split(/\s+/);
  return columns.length > 0 ? safeTrim(columns[0]) : "";
}

function collectLinuxIdentifiers(): string[] {
  const identifiers: string[] = [];

  const productUuid = safeReadFile("/sys/class/dmi/id/product_uuid");
  if (productUuid) {
    identifiers.push(productUuid);
  }

  const machineId =
    safeReadFile("/etc/machine-id") || safeReadFile("/var/lib/dbus/machine-id");
  if (machineId) {
    identifiers.push(machineId);
  }

  const rootDevice = resolveRootDevice();
  if (rootDevice) {
    const blkidOutput = safeExecFile("blkid", ["-s", "UUID", "-o", "value", rootDevice]);
    if (blkidOutput) {
      identifiers.push(blkidOutput);
    }
  }

  return identifiers;
}

function collectIdentifiers(): string[] {
  switch (process.platform) {
    case "darwin":
      return collectMacIdentifiers();
    case "win32":
      return collectWindowsIdentifiers();
    default:
      return collectLinuxIdentifiers();
  }
}

export function getDeviceFingerprint(): string {
  if (cachedFingerprint) {
    return cachedFingerprint;
  }

  const identifiers = collectIdentifiers()
    .map((value) => safeTrim(value))
    .filter(Boolean);

  if (identifiers.length === 0) {
    const fallback = randomUUID().replace(/-/g, "");
    cachedFingerprint = fallback.slice(0, 32).padEnd(32, "0");
    return cachedFingerprint;
  }

  const hash = createHash("sha256");
  for (const value of identifiers) {
    hash.update(value);
    hash.update("|");
  }
  hash.update(os.type());
  hash.update("|rushmeme-device-fingerprint");

  cachedFingerprint = hash.digest("hex").slice(0, 32);
  return cachedFingerprint;
}
