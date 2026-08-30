// Rollback the local DevEco Code installation to the most recent backup.
// Usage: bun run rollback:local
//
// Reads the latest-backup.json manifest written by install-local.ts, verifies
// the backup fingerprint, stops the running app, restores the backup, and
// re-verifies after copy.

import { spawnSync } from "node:child_process"
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { homedir } from "node:os"
import { resolve, join } from "node:path"

const desktopRoot = resolve(import.meta.dir, "..")

const platform = (() => {
  if (process.platform === "darwin") {
    return {
      root: "/Applications/DevEco Code.app",
      appOut: ["Contents", "Resources", "app", "out"],
      close: () => spawnSync("osascript", ["-e", 'tell application "DevEco Code" to quit'], { stdio: "ignore" }),
    }
  }
  if (process.platform === "linux") {
    return {
      root: resolve(homedir(), ".local", "opt", "DevEco Code"),
      appOut: ["resources", "app", "out"],
      close: () => spawnSync("pkill", ["-f", "ai.opencode.desktop"], { stdio: "ignore" }),
    }
  }
  return {
    root: "E:\\finish\\DevEco Code",
    appOut: ["resources", "app", "out"],
    close: () => spawnSync("taskkill", ["/IM", "DevEco Code.exe", "/F"], { stdio: "ignore" }),
  }
})()

const portableRoot = process.env.DEVECO_CODE_INSTALL_DIR
  ? resolve(process.env.DEVECO_CODE_INSTALL_DIR)
  : platform.root
const portableAppOut = resolve(portableRoot, ...platform.appOut)
const backupDir = resolve(portableRoot, "..", ".deveco-backups")
const manifestPath = resolve(backupDir, "latest-backup.json")

if (!existsSync(manifestPath)) {
  console.error(`No backup manifest found: ${manifestPath}`)
  console.error("Rollback is only available after at least one install:local run.")
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
  timestamp: string
  source: string
  backupPath: string
  appVersion?: string | null
  fingerprint: { fileCount: number; totalBytes: number; sampleHash: string }
}

if (!existsSync(manifest.backupPath)) {
  console.error(`Backup directory no longer exists: ${manifest.backupPath}`)
  process.exit(1)
}

function computeDirFingerprint(dir: string): { fileCount: number; totalBytes: number; sampleHash: string } {
  let fileCount = 0
  let totalBytes = 0
  let samplePath = ""
  function walk(d: string) {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry)
      const st = statSync(full)
      if (st.isDirectory()) walk(full)
      else {
        fileCount++
        totalBytes += st.size
        if (!samplePath && st.size > 0 && st.size < 10 * 1024 * 1024) samplePath = full
      }
    }
  }
  walk(dir)
  let sampleHash = "empty"
  if (samplePath) {
    sampleHash = createHash("sha256").update(readFileSync(samplePath)).digest("hex")
  }
  return { fileCount, totalBytes, sampleHash }
}

console.log(`Backup from ${manifest.timestamp}`)
console.log(`  Source:  ${manifest.source}`)
console.log(`  Path:    ${manifest.backupPath}`)

const currentFp = computeDirFingerprint(manifest.backupPath)
const expected = manifest.fingerprint
if (currentFp.fileCount !== expected.fileCount || currentFp.totalBytes !== expected.totalBytes) {
  console.error("Backup fingerprint mismatch — backup may be corrupted.")
  console.error(`  Expected: files=${expected.fileCount} bytes=${expected.totalBytes}`)
  console.error(`  Actual:   files=${currentFp.fileCount} bytes=${currentFp.totalBytes}`)
  console.error("Aborting rollback. Inspect the backup manually before retrying.")
  process.exit(1)
}
console.log(`Backup verified: files=${currentFp.fileCount} bytes=${currentFp.totalBytes}`)

console.log("Stopping DevEco Code...")
platform.close()
Bun.sleepSync(1500)

console.log(`Restoring backup to ${portableAppOut}`)
if (existsSync(portableAppOut)) rmSync(portableAppOut, { recursive: true, force: true })
cpSync(manifest.backupPath, portableAppOut, { recursive: true })

const restoredFp = computeDirFingerprint(portableAppOut)
if (restoredFp.fileCount !== expected.fileCount || restoredFp.totalBytes !== expected.totalBytes) {
  console.error("Post-restore verification failed — file count or size mismatch.")
  process.exit(1)
}

const appPackagePath = resolve(portableAppOut, "..", "package.json")
if (manifest.appVersion) {
  try {
    const text = readFileSync(appPackagePath, "utf8")
    const app = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text) as Record<string, unknown>
    if (app.version !== manifest.appVersion) {
      writeFileSync(appPackagePath, JSON.stringify({ ...app, version: manifest.appVersion }, null, 2) + "\n")
      console.log(`  Restored app version: ${String(app.version)} -> ${manifest.appVersion}`)
    }
  } catch (err) {
    console.warn("App package.json version not restored (out/ was restored):", err)
  }
} else {
  console.warn("This backup predates app version tracking; resources/app/package.json was left as-is.")
}

console.log("Rollback complete. Installation restored to pre-overwrite state.")
console.log(`  Restored from backup: ${manifest.timestamp}`)
