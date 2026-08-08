import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { SkillManager } from "./skill-manager"

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("SkillManager", () => {
  test("removes only skills installed in the managed root", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "deveco-capabilities-"))
    roots.push(root)
    const managed = path.join(root, "managed")
    const external = path.join(root, "external", "skill-a")
    await mkdir(external, { recursive: true })
    await writeFile(path.join(external, "SKILL.md"), "---\nname: skill-a\n---\n")

    const manager = SkillManager.make({ root: managed })

    await expect(manager.uninstall("skill-a", path.join(external, "SKILL.md"))).rejects.toThrow("managed skills root")
  })
})
