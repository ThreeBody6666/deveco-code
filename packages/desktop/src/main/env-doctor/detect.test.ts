import { describe, expect, test } from "bun:test"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  DEFAULT_DEVECO_STUDIO_WIN_PATHS,
  DEFAULT_DEVECO_STUDIO_MAC_PATHS,
  DEFAULT_DEVECO_STUDIO_LINUX_PATHS,
  detectDevEcoStudio,
  installGuideFor,
  summarizeReport,
  ENV_DOCTOR_COMPONENTS,
} from "./detect"

const withTemp = async (fn: (dir: string) => Promise<void>) => {
  const dir = await mkdtemp(join(tmpdir(), "env-doctor-"))
  try {
    await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

describe("env doctor detect", () => {
  test("known Windows DevEco Studio install paths include Huawei default", () => {
    expect(DEFAULT_DEVECO_STUDIO_WIN_PATHS).toContain("C:\\Program Files\\Huawei\\DevEco Studio")
  })

  test("macOS DevEco Studio paths point at the .app bundle Contents directory", () => {
    expect(DEFAULT_DEVECO_STUDIO_MAC_PATHS).toContain("/Applications/DevEco-Studio.app/Contents")
    // 每条 Mac 路径都以 DevEco-Studio.app/<Contents> 结尾（路径分隔符跨平台不固定）
    for (const p of DEFAULT_DEVECO_STUDIO_MAC_PATHS) {
      const normalized = p.replace(/\\/g, "/")
      expect(normalized.endsWith("/DevEco-Studio.app/Contents")).toBe(true)
    }
  })

  test("Linux DevEco Studio paths cover system and per-user installations", () => {
    expect(DEFAULT_DEVECO_STUDIO_LINUX_PATHS).toContain("/opt/DevEco-Studio")
    expect(DEFAULT_DEVECO_STUDIO_LINUX_PATHS.some((path) => path.includes(".local"))).toBe(true)
  })

  test("detectDevEcoStudio accepts a macOS-style Contents path as studio home", async () => {
    await withTemp(async (dir) => {
      // 模拟 .app bundle 内 Contents 目录结构
      const contents = join(dir, "DevEco-Studio.app", "Contents")
      await mkdir(join(contents, "tools", "node"), { recursive: true })
      await writeFile(join(contents, "product-info.json"), JSON.stringify({ version: "6.1.0" }), "utf8")

      const result = await detectDevEcoStudio([contents])

      expect(result.status).toBe("ok")
      expect(result.path).toBe(contents)
      expect(result.version).toBe("6.1.0")
    })
  })

  test("declares the four required components in stable order", () => {
    expect(ENV_DOCTOR_COMPONENTS.map((c) => c.id)).toEqual([
      "deveco-code",
      "deveco-studio",
      "deveco-cli",
      "node",
    ])
  })

  test("detectDevEcoStudio returns ok when product-info.json is valid", async () => {
    await withTemp(async (dir) => {
      const studioHome = join(dir, "DevEco Studio")
      await mkdir(join(studioHome, "tools", "node"), { recursive: true })
      await writeFile(join(studioHome, "product-info.json"), JSON.stringify({ version: "6.0.1" }), "utf8")

      const result = await detectDevEcoStudio([studioHome])

      expect(result.status).toBe("ok")
      expect(result.path).toBe(studioHome)
      expect(result.version).toBe("6.0.1")
    })
  })

  test("detectDevEcoStudio marks version too old", async () => {
    await withTemp(async (dir) => {
      const studioHome = join(dir, "DevEco Studio")
      await mkdir(join(studioHome, "tools", "node"), { recursive: true })
      await writeFile(join(studioHome, "product-info.json"), JSON.stringify({ version: "5.0.0" }), "utf8")

      const result = await detectDevEcoStudio([studioHome])

      expect(result.status).toBe("outdated")
      expect(result.version).toBe("5.0.0")
    })
  })

  test("detectDevEcoStudio returns missing when none of the paths exist", async () => {
    await withTemp(async (dir) => {
      const result = await detectDevEcoStudio([join(dir, "nowhere")])
      expect(result.status).toBe("missing")
    })
  })

  test("installGuideFor exposes an official download URL for each missing component", () => {
    for (const c of ENV_DOCTOR_COMPONENTS) {
      const guide = installGuideFor(c.id)
      expect(guide.url.length).toBeGreaterThan(0)
      expect(guide.url).toMatch(/^https?:\/\//)
    }
  })

  test("summarizeReport reports missing when any required component is missing", () => {
    const summary = summarizeReport([
      { id: "deveco-code", status: "ok", version: "1.17.9" },
      { id: "deveco-studio", status: "missing" },
      { id: "deveco-cli", status: "ok", version: "1.0.0" },
      { id: "node", status: "ok", version: "22.0.0" },
    ])
    expect(summary.healthy).toBe(false)
    expect(summary.missing.map((m) => m.id)).toContain("deveco-studio")
  })

  test("summarizeReport is healthy when every component is ok", () => {
    const summary = summarizeReport([
      { id: "deveco-code", status: "ok", version: "1.17.9" },
      { id: "deveco-studio", status: "ok", version: "6.0.1", path: "C:\\Program Files\\Huawei\\DevEco Studio" },
      { id: "deveco-cli", status: "ok", version: "1.0.0" },
      { id: "node", status: "ok", version: "22.0.0" },
    ])
    expect(summary.healthy).toBe(true)
    expect(summary.missing).toEqual([])
  })
})
