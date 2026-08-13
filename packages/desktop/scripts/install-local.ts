// Local development: build, stop the running app, and replace its renderer output.
// Usage: bun run install:local
// Override the platform default with DEVECO_CODE_INSTALL_DIR when needed.
//
// Before overwriting, the current renderer output is backed up to a timestamped
// directory next to the installation.  A manifest.json next to the backup
// records a SHA-256 fingerprint so rollback can verify integrity.
// Pass --skip-backup to opt out (not recommended).

import { spawnSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { homedir } from "node:os"
import { resolve, join } from "node:path"

const skipBackup = process.argv.includes("--skip-backup")
const desktopRoot = resolve(import.meta.dir, "..")
const outDir = resolve(desktopRoot, "out")

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

if (!existsSync(outDir)) {
  console.error(`Build output not found: ${outDir}`)
  process.exit(1)
}
if (!existsSync(portableRoot)) {
  console.error(`DevEco Code installation not found: ${portableRoot}`)
  console.error("Set DEVECO_CODE_INSTALL_DIR to the unpacked application directory.")
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

if (existsSync(portableAppOut) && !skipBackup) {
  mkdirSync(backupDir, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const backupName = `out-backup-${timestamp}`
  const backupPath = resolve(backupDir, backupName)

  console.log(`Backing up current renderer output to ${backupPath}`)
  cpSync(portableAppOut, backupPath, { recursive: true })

  const fingerprint = computeDirFingerprint(backupPath)
  const manifest = {
    timestamp: new Date().toISOString(),
    source: portableAppOut,
    backupPath,
    fingerprint,
  }
  const manifestPath = resolve(backupDir, "latest-backup.json")
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n")
  console.log(`Backup fingerprint: files=${fingerprint.fileCount} bytes=${fingerprint.totalBytes} sampleHash=${fingerprint.sampleHash.slice(0, 12)}...`)
} else if (skipBackup) {
  console.log("Skipping backup (--skip-backup flag set).")
}

console.log("Stopping DevEco Code...")
platform.close()
Bun.sleepSync(1500)

console.log(`Replacing renderer output at ${portableAppOut}`)
try {
  if (existsSync(portableAppOut)) rmSync(portableAppOut, { recursive: true, force: true })
  cpSync(outDir, portableAppOut, { recursive: true })
} catch (err) {
  console.error("Failed to replace renderer output:", err)
  if (!skipBackup) {
    console.error(`You can rollback from: ${resolve(backupDir, "latest-backup.json")}`)
    console.error("Run: bun run rollback:local")
  }
  process.exit(1)
}

console.log("Local installation updated.")
if (!skipBackup) {
  console.log(`Backup stored at ${backupDir}`)
  console.log("To rollback: bun run rollback:local")
}
