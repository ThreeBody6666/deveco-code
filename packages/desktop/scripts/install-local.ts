// 本地开发用：改代码 → 重新编译 → 覆盖到便携版目录 → 双击原快捷方式打开最新版
// 用法：  bun run install:local
//
// 你桌面的 DevEco Code.lnk 指向 E:\finish\DevEco Code\DevEco Code.exe（便携版目录）。
// 本脚本流程：
// 1. 关掉正在跑的 DevEco Code.exe
// 2. 把刚 build 出来的 out/ 目录覆盖到便携版的 resources/app/out/
// 3. 完成 —— 双击原桌面快捷方式即为最新版

import { spawnSync } from "node:child_process"
import { cpSync, existsSync, rmSync } from "node:fs"
import { resolve } from "node:path"

const desktopRoot = resolve(import.meta.dir, "..")
const outDir = resolve(desktopRoot, "out")
const portableRoot = "E:\\finish\\DevEco Code"
const portableAppOut = resolve(portableRoot, "resources", "app", "out")

if (!existsSync(outDir)) {
  console.error(`❌ 没找到编译产物 ${outDir}，请确认 build 已完成`)
  process.exit(1)
}
if (!existsSync(portableRoot)) {
  console.error(`❌ 便携版目录不存在: ${portableRoot}`)
  process.exit(1)
}

console.log("→ 关闭正在运行的 DevEco Code…")
spawnSync("taskkill", ["/IM", "DevEco Code.exe", "/F"], { stdio: "ignore" })
// 给系统一点时间释放文件句柄
Bun.sleepSync(1000)

console.log(`→ 备份并覆盖 out/ 到 ${portableAppOut}`)
try {
  if (existsSync(portableAppOut)) rmSync(portableAppOut, { recursive: true, force: true })
  cpSync(outDir, portableAppOut, { recursive: true })
} catch (err) {
  console.error("❌ 覆盖失败:", err)
  process.exit(1)
}

console.log("✅ 完成。双击桌面 DevEco Code 快捷方式即为最新版。")
