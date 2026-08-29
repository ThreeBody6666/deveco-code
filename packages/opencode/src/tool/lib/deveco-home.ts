/*
 * Copyright (c) 2026 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from "fs/promises";
import path from "path";
import semver from "semver";
import { Global } from "@opencode-ai/core/global";

export const MIN_DEVECO_STUDIO_VERSION = "6.0.0";

export const UI_VERIFY_ENV = ["UI_VERIFY_BASE_URL", "UI_VERIFY_API_KEY", "UI_VERIFY_MODEL_NAME"] as const;

const productFileName = "product-info.json";

export type DevEcoHomeRejectReason = "MISSING_DIR" | "NO_NODE" | "NO_PRODUCT_INFO" | "BAD_VERSION";

export type DevEcoHomeRejection = {
  path: string;
  reason: DevEcoHomeRejectReason;
};

export type DevEcoHomeSource = "env" | "saved" | "discovered";

export type DevEcoHomeValidation =
  | { ok: true; home: string; version: string }
  | { ok: false; reason: DevEcoHomeRejectReason };

export type DevEcoHomeOutcome =
  | { ok: true; home: string; version: string; source: DevEcoHomeSource; rejections: DevEcoHomeRejection[] }
  | { ok: false; rejections: DevEcoHomeRejection[]; tried: string[] };

/* Users routinely point DEVECO_HOME at a container folder one or two levels above the real
 * install root (e.g. `E:\DevEco Studio\xin\DevEco Studio`), so a shallow path is descended
 * into rather than rejected. Depth, fan-out and probe count stay bounded because this runs
 * against live drives. */
const MAX_DEPTH = 2;
const MAX_CHILDREN = 24;
const MAX_PROBES = 120;
const SKIP_DIRS = new Set([
  "bin",
  "build",
  "help",
  "jbr",
  "lib",
  "license",
  "modules",
  "node_modules",
  "out",
  "plugins",
  "resources",
  "runtime",
  "sdk",
  "tools",
]);

const REJECT_HINTS: Record<DevEcoHomeRejectReason, string> = {
  MISSING_DIR: "the folder does not exist",
  NO_NODE: `missing tools${path.sep}node`,
  NO_PRODUCT_INFO: `missing ${productFileName}`,
  BAD_VERSION: `version is older than ${MIN_DEVECO_STUDIO_VERSION}`,
};

const savedDevEcoHomeFile = () => path.join(Global.Path.state, "deveco-home.json");

function binary(name: string) {
  return process.platform === "win32" ? `${name}.exe` : name;
}

function expansions(home: string) {
  const normalized = home.trim();
  if (!normalized) {
    return [];
  }
  if (process.platform === "win32" || path.basename(normalized) === "Contents") {
    return [normalized];
  }
  return [normalized, path.join(normalized, "Contents")];
}

function envPath() {
  return String(process.env.DEVECO_HOME || "").trim();
}

async function isDir(file: string) {
  if (!file) {
    return false;
  }
  return fs
    .stat(file)
    .then((info) => info.isDirectory())
    .catch(() => false);
}

function defaults() {
  if (process.platform === "darwin") {
    const home = String(process.env.HOME || "").trim();
    return [
      "/Applications/DevEco-Studio.app",
      home ? path.join(home, "Applications", "DevEco-Studio.app") : "",
    ].filter(Boolean);
  }
  if (process.platform === "linux") {
    const home = String(process.env.HOME || "").trim();
    return [
      "/opt/DevEco-Studio",
      "/usr/local/DevEco-Studio",
      home ? path.join(home, ".local", "share", "DevEco-Studio") : "",
      home ? path.join(home, "devecostudio") : "",
      home ? path.join(home, "DevEco-Studio") : "",
    ].filter(Boolean);
  }
  const home = String(process.env.USERPROFILE || "").trim();
  return [
    "D:\\DevEco Studio",
    "D:\\Huawei\\DevEco Studio",
    "C:\\Program Files\\Huawei\\DevEco Studio",
    "C:\\Program Files\\DevEco Studio",
    "C:\\Program Files (x86)\\DevEco Studio",
    home ? path.join(home, "DevEco Studio") : "",
  ].filter(Boolean);
}

export function nodePath(home: string) {
  return process.platform === "win32"
    ? path.join(home, "tools", "node", "node.exe")
    : path.join(home, "tools", "node", "bin", "node");
}

export function hvigorPath(home: string) {
  return path.join(home, "tools", "hvigor", "bin", "hvigorw.js");
}

export function sdkPath(home: string) {
  return path.join(home, "sdk");
}

export function hdcPath(home: string) {
  return path.join(home, "sdk", "default", "openharmony", "toolchains", binary("hdc"));
}

export function studioBinaryPath(home: string) {
  if (process.platform === "win32") return path.join(home, "bin", "devecostudio64.exe");
  if (process.platform === "darwin") return path.join(home, "MacOS", "DevEco-Studio");
  return path.join(home, "bin", "devecostudio.sh");
}

export function emulatorLauncherPath(home: string) {
  if (process.platform === "darwin") return path.join(home, "MacOS", "Emulator");
  return path.join(home, "tools", "emulator", binary("Emulator"));
}

function productInfoPath(home: string) {
  if (process.platform === "darwin") {
    return path.join(home, "Resources", productFileName);
  }
  return path.join(home, productFileName);
}

function parseDevEcoStudioVersion(raw: unknown) {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return semver.coerce(trimmed)?.version;
}

async function readDevEcoStudioVersion(home: string) {
  try {
    const text = await fs.readFile(productInfoPath(home), "utf8");
    const data = JSON.parse(text) as { version?: string };
    return parseDevEcoStudioVersion(data.version);
  } catch {
    return undefined;
  }
}

export async function validateHome(home: string): Promise<DevEcoHomeValidation> {
  const normalized = home.trim();
  if (!normalized || !(await isDir(normalized))) return { ok: false, reason: "MISSING_DIR" };
  if (!(await Bun.file(nodePath(normalized)).exists())) return { ok: false, reason: "NO_NODE" };
  const version = await readDevEcoStudioVersion(normalized);
  if (!version) return { ok: false, reason: "NO_PRODUCT_INFO" };
  if (!semver.gte(version, MIN_DEVECO_STUDIO_VERSION)) return { ok: false, reason: "BAD_VERSION" };
  return { ok: true, home: normalized, version };
}

type Probe = { path: string; validation: DevEcoHomeValidation };

/* A macOS .app bundle is a real folder that can never validate, so the reported reason comes
 * from the deepest candidate that existed rather than from the outermost one. */
async function probeHome(home: string): Promise<Probe | undefined> {
  let deepest: Probe | undefined;
  for (const candidate of expansions(home)) {
    const validation = await validateHome(candidate);
    if (validation.ok) return { path: candidate, validation };
    if (validation.reason !== "MISSING_DIR") deepest = { path: candidate, validation };
  }
  return deepest;
}

async function subdirectories(dir: string) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const names = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const ranked = names.sort((a, b) => Number(/deveco/i.test(b)) - Number(/deveco/i.test(a)));
  return ranked
    .slice(0, MAX_CHILDREN)
    .filter((name) => !SKIP_DIRS.has(name.toLowerCase()))
    .map((name) => path.join(dir, name));
}

async function descend(root: string) {
  let frontier = [root];
  let probes = 0;
  for (let depth = 0; depth < MAX_DEPTH && frontier.length > 0 && probes < MAX_PROBES; depth++) {
    const next: string[] = [];
    for (const dir of frontier) {
      for (const child of await subdirectories(dir)) {
        if (probes++ >= MAX_PROBES) return undefined;
        const found = await probeHome(child);
        if (found?.validation.ok) return found;
        next.push(child);
      }
    }
    frontier = next;
  }
  return undefined;
}

async function resolveSource(home: string): Promise<Probe | undefined> {
  if (!home.trim()) return undefined;
  const direct = await probeHome(home);
  if (direct?.validation.ok) return direct;
  return (await descend(home)) ?? direct;
}

export async function resolveDevEcoHome(home: string): Promise<string | undefined> {
  const found = await resolveSource(home);
  return found?.validation.ok ? found.validation.home : undefined;
}

export async function isDevEcoHome(home: string): Promise<boolean> {
  return Boolean(await resolveDevEcoHome(home));
}

export async function findDevEcoHomes(): Promise<string[]> {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of defaults()) {
    const home = await resolveDevEcoHome(item);
    if (!home || seen.has(home)) {
      continue;
    }
    seen.add(home);
    result.push(home);
  }
  return result;
}

async function readSavedDevEcoHomeRaw(): Promise<string | undefined> {
  try {
    const text = await fs.readFile(savedDevEcoHomeFile(), "utf8");
    const data = JSON.parse(text) as { deveco_home?: unknown };
    const home = typeof data.deveco_home === "string" ? data.deveco_home.trim() : "";
    return home || undefined;
  } catch {
    return undefined;
  }
}

export async function clearSavedDevEcoHome(): Promise<void> {
  await fs.unlink(savedDevEcoHomeFile()).catch(() => undefined);
}

export async function loadSavedDevEcoHome(): Promise<string | undefined> {
  const raw = await readSavedDevEcoHomeRaw();
  if (!raw) return undefined;
  const resolved = await resolveDevEcoHome(raw);
  if (resolved) return resolved;
  await clearSavedDevEcoHome();
  return undefined;
}

export async function saveDevEcoHome(home: string): Promise<string | undefined> {
  const resolved = await resolveDevEcoHome(home);
  if (!resolved) return undefined;
  await fs.writeFile(savedDevEcoHomeFile(), JSON.stringify({ deveco_home: resolved }, null, 2), "utf8");
  return resolved;
}

function rejectionOf(probe: Probe | undefined, declared: string): DevEcoHomeRejection | undefined {
  if (!probe || probe.validation.ok) return undefined;
  return { path: probe.path || declared, reason: probe.validation.reason };
}

async function resolveAll(): Promise<DevEcoHomeOutcome> {
  const rejections: DevEcoHomeRejection[] = [];

  const fromEnv = envPath();
  if (fromEnv) {
    const probe = await resolveSource(fromEnv);
    if (probe?.validation.ok) {
      return { ok: true, home: probe.validation.home, version: probe.validation.version, source: "env", rejections };
    }
    const rejection = rejectionOf(probe, fromEnv);
    if (rejection) rejections.push(rejection);
  }

  const saved = await readSavedDevEcoHomeRaw();
  if (saved) {
    const probe = await resolveSource(saved);
    if (probe?.validation.ok) {
      return { ok: true, home: probe.validation.home, version: probe.validation.version, source: "saved", rejections };
    }
    const rejection = rejectionOf(probe, saved);
    if (rejection) rejections.push(rejection);
    await clearSavedDevEcoHome();
  }

  const tried: string[] = [];
  for (const candidate of defaults()) {
    tried.push(candidate);
    const probe = await resolveSource(candidate);
    if (probe?.validation.ok) {
      return {
        ok: true,
        home: probe.validation.home,
        version: probe.validation.version,
        source: "discovered",
        rejections,
      };
    }
  }
  return { ok: false, rejections, tried };
}

/* Every HarmonyOS tool call resolves the home, so one scan per (DEVECO_HOME, state dir) is
 * memoized; both inputs are in the key, so a reconfigured path or a test that swaps the state
 * directory busts the cache without an explicit reset. */
let cached: { key: string; promise: Promise<DevEcoHomeOutcome> } | undefined;

export function getDevEcoHome(): Promise<DevEcoHomeOutcome> {
  const key = `${envPath()}|${Global.Path.state}`;
  if (cached?.key === key) return cached.promise;
  const promise = resolveAll();
  cached = { key, promise };
  return promise;
}

export function invalidateDevEcoHomeCache(): void {
  cached = undefined;
}

export async function findDevEcoHome(): Promise<string | undefined> {
  const outcome = await getDevEcoHome();
  return outcome.ok ? outcome.home : undefined;
}

export function devEcoHomeWarning(outcome: DevEcoHomeOutcome): string | undefined {
  if (!outcome.ok || outcome.rejections.length === 0) return undefined;
  const detail = outcome.rejections.map((item) => `${item.path} (${REJECT_HINTS[item.reason]})`).join("; ");
  return `DevEco Studio home ${outcome.home} was found by scanning because a configured path was unusable: ${detail}.`;
}

export function devEcoHomeMissingMessage(outcome: DevEcoHomeOutcome): string {
  if (outcome.ok) return "";
  const parts = ["DevEco Studio was not found."];
  for (const item of outcome.rejections) {
    parts.push(`"${item.path}" is not an install root: ${REJECT_HINTS[item.reason]}.`);
  }
  parts.push(
    `Point DEVECO_HOME at the folder that directly contains ${productFileName} and tools${path.sep}node, or choose it in Settings, then restart.`,
  );
  if (outcome.rejections.length === 0 && outcome.tried.length > 0) {
    parts.push(`Searched: ${outcome.tried.join(", ")}.`);
  }
  return parts.join(" ");
}

export function buildEnv(home: string, sdk: string) {
  const sep = process.platform === "win32" ? ";" : ":";
  const raw = process.env.PATH || process.env.Path || process.env.path || "";
  const sys = process.platform === "win32" ? process.env.SystemRoot || process.env.SYSTEMROOT || "C:\\Windows" : "";
  const base = process.platform === "win32" ? path.join(sys, "System32") : "";
  const current = [
    base,
    sys,
    process.platform === "win32" ? path.join(base, "Wbem") : "",
    process.platform === "win32" ? path.join(base, "WindowsPowerShell", "v1.0") : "",
    raw,
  ]
    .filter(Boolean)
    .join(sep);
  const extra = [
    // Windows ships node directly under tools\node; only mac/linux nest it in bin.
    process.platform === "win32" ? path.join(home, "tools", "node") : path.join(home, "tools", "node", "bin"),
    path.join(home, "tools", "ohpm", "bin"),
    path.join(home, "tools", "hvigor", "bin"),
  ];
  const merged = [...extra, current].filter(Boolean).join(sep);
  const cmd = process.platform === "win32" ? process.env.ComSpec || process.env.COMSPEC || path.join(base, "cmd.exe") : "";
  return {
    DEVECO_HOME: home,
    DEVECO_SDK_HOME: sdk,
    ...(process.platform === "win32"
      ? {
          SystemRoot: sys,
          SYSTEMROOT: sys,
          ComSpec: cmd,
          COMSPEC: cmd,
          Path: merged,
        }
      : {}),
    PATH: merged,
  };
}
