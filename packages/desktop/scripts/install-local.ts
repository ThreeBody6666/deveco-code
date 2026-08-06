// Local development: build, stop the running app, and replace its renderer output.
// Usage: bun run install:local
// Override the platform default with DEVECO_CODE_INSTALL_DIR when needed.

import { spawnSync } from "node:child_process"
import { cpSync, existsSync, rmSync } from "node:fs"
import { homedir } from "node:os"
import { resolve } from "node:path"

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

if (!existsSync(outDir)) {
  console.error(`Build output not found: ${outDir}`)
  process.exit(1)
}
if (!existsSync(portableRoot)) {
  console.error(`DevEco Code installation not found: ${portableRoot}`)
  console.error("Set DEVECO_CODE_INSTALL_DIR to the unpacked application directory.")
  process.exit(1)
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
  process.exit(1)
}

console.log("Local installation updated.")
