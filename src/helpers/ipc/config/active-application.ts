import { execFile } from "node:child_process";
import { basename } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ActiveApplicationInfo = {
  name?: string;
  bundleId?: string;
  processName?: string;
  executable?: string;
  path?: string;
};

async function getActiveApplicationMac(): Promise<ActiveApplicationInfo | null> {
  const script = `
    tell application "System Events"
      if (count of (processes whose frontmost is true)) = 0 then
        return ""
      end if
      set frontApp to first process whose frontmost is true
      set appName to name of frontApp
      set bundleId to ""
      try
        set bundleId to bundle identifier of frontApp
      end try
      return appName & "::" & bundleId
    end tell
  `.trim();

  try {
    const { stdout } = await execFileAsync("osascript", ["-e", script]);
    const payload = stdout.trim();
    if (!payload) {
      return null;
    }
    const [rawName = "", rawBundle = ""] = payload.split("::");
    const name = rawName.trim();
    const bundleId = rawBundle.trim();
    if (!name && !bundleId) {
      return null;
    }
    return {
      name: name || undefined,
      bundleId: bundleId || undefined,
      processName: name || undefined,
      executable: name ? `${name}.app` : undefined,
    };
  } catch (error) {
    console.warn(
      "[rushmeme] failed to resolve frontmost macOS application:",
      error,
    );
    return null;
  }
}

async function getActiveApplicationWindows(): Promise<ActiveApplicationInfo | null> {
  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NativeMethods {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@

$handle = [NativeMethods]::GetForegroundWindow()
if ($handle -eq [IntPtr]::Zero) { return }
$processId = 0
[NativeMethods]::GetWindowThreadProcessId($handle, [ref]$processId) | Out-Null
if ($processId -eq 0) { return }

try {
  $process = Get-Process -Id $processId -ErrorAction Stop
  $path = ""
  try {
    $path = $process.MainModule.FileName
  } catch {
    try {
      $path = $process.Path
    } catch {
      $path = ""
    }
  }
  $line = "{0}::{1}" -f $process.ProcessName, $path
  [Console]::WriteLine($line)
} catch {
}
  `.trim();

  try {
    const { stdout } = await execFileAsync("powershell", [
      "-NoProfile",
      "-Command",
      script,
    ]);
    const payload = stdout.trim();
    if (!payload) {
      return null;
    }
    const [rawProcess = "", rawPath = ""] = payload.split("::");
    const processName = rawProcess.trim();
    const resolvedPath = rawPath.trim();
    const executable = resolvedPath ? basename(resolvedPath) : processName;
    return {
      name: processName || undefined,
      processName: processName || undefined,
      path: resolvedPath || undefined,
      executable: executable || undefined,
    };
  } catch (error) {
    console.warn(
      "[rushmeme] failed to resolve foreground Windows application:",
      error,
    );
    return null;
  }
}

export async function getActiveApplication(): Promise<ActiveApplicationInfo | null> {
  if (process.platform === "darwin") {
    return getActiveApplicationMac();
  }
  if (process.platform === "win32") {
    return getActiveApplicationWindows();
  }
  return null;
}

export function collectApplicationCandidates(
  info: ActiveApplicationInfo | null,
): string[] {
  if (!info) {
    return [];
  }

  const candidates = new Set<string>();
  const add = (value?: string) => {
    if (value && value.trim()) {
      candidates.add(value.trim());
    }
  };

  add(info.name);
  add(info.bundleId);
  add(info.processName);
  add(info.executable);
  add(info.path);
  if (info.path) {
    add(basename(info.path));
  }

  return Array.from(candidates);
}
