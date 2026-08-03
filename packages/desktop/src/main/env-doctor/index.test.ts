import { describe, expect, test } from "bun:test"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { createEnvDoctorController } from "./index"

const withTemp = async (fn: (dir: string) => Promise<void>) => {
  const dir = await mkdtemp(join(tmpdir(), "env-doctor-ctrl-"))
  try {
    await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

describe("createEnvDoctorController", () => {
  test("scan reports own app as ok using injected metadata", async () => {
    const controller = createEnvDoctorController({
      selfVersion: () => "1.17.9",
      resolveNode: async () => ({ status: "ok", version: "22.5.0", path: "C:\\node\\node.exe" }),
      resolveDevEcoCli: async () => ({ status: "missing" }),
      studioSearchPaths: () => [],
      readCustomStudioPath: async () => undefined,
    })

    const report = await controller.scan()

    const self = report.items.find((i) => i.id === "deveco-code")
    expect(self?.status).toBe("ok")
    expect(self?.version).toBe("1.17.9")
    expect(report.summary.healthy).toBe(false)
    expect(report.summary.missing.map((m) => m.id)).toContain("deveco-cli")
  })

  test("scan honors saved custom DevEco Studio path", async () => {
    await withTemp(async (dir) => {
      const studio = join(dir, "custom-studio")
      await mkdir(join(studio, "tools", "node"), { recursive: true })
      await writeFile(join(studio, "product-info.json"), JSON.stringify({ version: "6.0.2" }))

      const controller = createEnvDoctorController({
        selfVersion: () => "1.17.9",
        resolveNode: async () => ({ status: "ok", version: "22.5.0" }),
        resolveDevEcoCli: async () => ({ status: "ok", version: "1.2.3" }),
        studioSearchPaths: () => [],
        readCustomStudioPath: async () => studio,
      })

      const report = await controller.scan()
      const studioItem = report.items.find((i) => i.id === "deveco-studio")
      expect(studioItem?.status).toBe("ok")
      expect(studioItem?.path).toBe(studio)
      expect(report.summary.healthy).toBe(true)
    })
  })

  test("setStudioPath persists to storage and next scan uses it", async () => {
    await withTemp(async (dir) => {
      const studio = join(dir, "picked-studio")
      await mkdir(join(studio, "tools", "node"), { recursive: true })
      await writeFile(join(studio, "product-info.json"), JSON.stringify({ version: "6.0.5" }))

      let saved: string | undefined = undefined
      const controller = createEnvDoctorController({
        selfVersion: () => "1.17.9",
        resolveNode: async () => ({ status: "ok", version: "22.5.0" }),
        resolveDevEcoCli: async () => ({ status: "ok", version: "1.2.3" }),
        studioSearchPaths: () => [],
        readCustomStudioPath: async () => saved,
        writeCustomStudioPath: async (p) => {
          saved = p
        },
      })

      await controller.setStudioPath(studio)
      expect(saved).toBe(studio)

      const report = await controller.scan()
      const item = report.items.find((i) => i.id === "deveco-studio")
      expect(item?.status).toBe("ok")
      expect(item?.path).toBe(studio)
    })
  })
})
