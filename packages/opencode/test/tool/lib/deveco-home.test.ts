import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { Global } from "@opencode-ai/core/global"
import {
  buildEnv,
  clearSavedDevEcoHome,
  devEcoHomeMissingMessage,
  devEcoHomeWarning,
  findDevEcoHome,
  getDevEcoHome,
  hdcPath,
  hvigorPath,
  invalidateDevEcoHomeCache,
  isDevEcoHome,
  loadSavedDevEcoHome,
  MIN_DEVECO_STUDIO_VERSION,
  nodePath,
  resolveDevEcoHome,
  saveDevEcoHome,
  sdkPath,
  validateHome,
} from "../../../src/tool/lib/deveco-home"
import { tmpdir } from "../../fixture/fixture"

async function scaffoldDevEcoHome(base: string, version = "6.1.0") {
  const node = nodePath(base)
  await fs.mkdir(path.dirname(node), { recursive: true })
  await Bun.write(node, "")
  const product =
    process.platform === "darwin"
      ? path.join(base, "Resources", "product-info.json")
      : path.join(base, "product-info.json")
  await fs.mkdir(path.dirname(product), { recursive: true })
  await Bun.write(product, JSON.stringify({ version }))
  return base
}

function withDevecoHome(value: string | undefined, run: () => Promise<void>) {
  const previous = process.env.DEVECO_HOME
  if (value === undefined) delete process.env.DEVECO_HOME
  else process.env.DEVECO_HOME = value
  return run().finally(() => {
    if (previous === undefined) delete process.env.DEVECO_HOME
    else process.env.DEVECO_HOME = previous
  })
}

describe("DEVECO_HOME recognition", () => {
  let previousState = Global.Path.state

  async function useStateDir(tmpPath: string) {
    previousState = Global.Path.state
    Global.Path.state = path.join(tmpPath, "state")
    await fs.mkdir(Global.Path.state, { recursive: true })
  }

  afterEach(async () => {
    Global.Path.state = previousState
    invalidateDevEcoHomeCache()
    await withDevecoHome(undefined, async () => {
      await clearSavedDevEcoHome()
    })
  })

  describe("resolveDevEcoHome()", () => {
    test("returns undefined for empty or whitespace-only path", async () => {
      expect(await resolveDevEcoHome("")).toBeUndefined()
      expect(await resolveDevEcoHome("   ")).toBeUndefined()
    })

    test("returns undefined when directory does not exist", async () => {
      await using tmp = await tmpdir()
      const missing = path.join(tmp.path, "missing-deveco")
      expect(await resolveDevEcoHome(missing)).toBeUndefined()
    })

    test("returns undefined when node binary is missing", async () => {
      await using tmp = await tmpdir()
      const home = path.join(tmp.path, "deveco-no-node")
      await fs.mkdir(home, { recursive: true })
      const product =
        process.platform === "darwin"
          ? path.join(home, "Resources", "product-info.json")
          : path.join(home, "product-info.json")
      await fs.mkdir(path.dirname(product), { recursive: true })
      await Bun.write(product, JSON.stringify({ version: "6.1.0" }))
      expect(await resolveDevEcoHome(home)).toBeUndefined()
    })

    test("returns undefined when product-info.json is missing", async () => {
      await using tmp = await tmpdir()
      const home = path.join(tmp.path, "deveco-no-product")
      await fs.mkdir(path.dirname(nodePath(home)), { recursive: true })
      await Bun.write(nodePath(home), "")
      expect(await resolveDevEcoHome(home)).toBeUndefined()
    })

    test(`returns undefined when version is below ${MIN_DEVECO_STUDIO_VERSION}`, async () => {
      await using tmp = await tmpdir()
      const home = path.join(tmp.path, "deveco-old")
      await scaffoldDevEcoHome(home, "5.1.0")
      expect(await resolveDevEcoHome(home)).toBeUndefined()
    })

    test("accepts minimum supported version", async () => {
      await using tmp = await tmpdir()
      const home = path.join(tmp.path, "deveco-min")
      await scaffoldDevEcoHome(home, MIN_DEVECO_STUDIO_VERSION)
      expect(await resolveDevEcoHome(home)).toBe(home)
    })

    test("resolves trimmed path with surrounding whitespace", async () => {
      await using tmp = await tmpdir()
      const home = path.join(tmp.path, "deveco-trim")
      await scaffoldDevEcoHome(home)
      expect(await resolveDevEcoHome(`  ${home}  `)).toBe(home)
    })

    test("resolves macOS .app bundle via Contents subdirectory", async () => {
      if (process.platform !== "darwin") return
      await using tmp = await tmpdir()
      const bundle = path.join(tmp.path, "DevEco-Studio.app")
      const contents = path.join(bundle, "Contents")
      await scaffoldDevEcoHome(contents)
      expect(await resolveDevEcoHome(bundle)).toBe(contents)
    })
  })

  describe("isDevEcoHome()", () => {
    test("returns true for a valid installation", async () => {
      await using tmp = await tmpdir()
      const home = path.join(tmp.path, "deveco-valid")
      await scaffoldDevEcoHome(home)
      expect(await isDevEcoHome(home)).toBe(true)
    })

    test("returns false for an invalid path", async () => {
      await using tmp = await tmpdir()
      expect(await isDevEcoHome(path.join(tmp.path, "not-deveco"))).toBe(false)
    })
  })

  describe("findDevEcoHome()", () => {
    test("prefers DEVECO_HOME when it points to a valid installation", async () => {
      await using tmp = await tmpdir()
      const envHome = path.join(tmp.path, "from-env")
      const savedHome = path.join(tmp.path, "from-saved")
      await scaffoldDevEcoHome(envHome)
      await scaffoldDevEcoHome(savedHome)

      await useStateDir(tmp.path)
      await saveDevEcoHome(savedHome)

      await withDevecoHome(envHome, async () => {
        expect(await findDevEcoHome()).toBe(envHome)
      })
    })

    test("falls back to saved path when DEVECO_HOME is unset", async () => {
      await using tmp = await tmpdir()
      const savedHome = path.join(tmp.path, "saved-only")
      await scaffoldDevEcoHome(savedHome)

      await useStateDir(tmp.path)
      await saveDevEcoHome(savedHome)

      await withDevecoHome(undefined, async () => {
        expect(await findDevEcoHome()).toBe(savedHome)
      })
    })

    test("falls back to saved path when DEVECO_HOME is whitespace-only", async () => {
      await using tmp = await tmpdir()
      const savedHome = path.join(tmp.path, "saved-whitespace")
      await scaffoldDevEcoHome(savedHome)

      await useStateDir(tmp.path)
      await saveDevEcoHome(savedHome)

      await withDevecoHome("   ", async () => {
        expect(await findDevEcoHome()).toBe(savedHome)
      })
    })

    test("falls back to saved path when DEVECO_HOME is invalid", async () => {
      await using tmp = await tmpdir()
      const savedHome = path.join(tmp.path, "saved-fallback")
      await scaffoldDevEcoHome(savedHome)

      await useStateDir(tmp.path)
      await saveDevEcoHome(savedHome)

      await withDevecoHome(path.join(tmp.path, "invalid-deveco"), async () => {
        expect(await findDevEcoHome()).toBe(savedHome)
      })
    })

    test("returns undefined when DEVECO_HOME, saved path, and defaults are all unavailable", async () => {
      await using tmp = await tmpdir()
      await useStateDir(tmp.path)

      await withDevecoHome(path.join(tmp.path, "missing"), async () => {
        expect(await findDevEcoHome()).toBeUndefined()
      })
    })
  })

  describe("saveDevEcoHome() / loadSavedDevEcoHome()", () => {
    test("persists and reloads a validated home path", async () => {
      await using tmp = await tmpdir()
      const home = path.join(tmp.path, "persisted")
      await scaffoldDevEcoHome(home)

      await useStateDir(tmp.path)

      expect(await saveDevEcoHome(home)).toBe(home)
      expect(await loadSavedDevEcoHome()).toBe(home)
    })

    test("rejects and does not persist an invalid home path", async () => {
      await using tmp = await tmpdir()
      await useStateDir(tmp.path)

      expect(await saveDevEcoHome(path.join(tmp.path, "invalid"))).toBeUndefined()
      expect(await loadSavedDevEcoHome()).toBeUndefined()
    })

    test("clears stale saved path when installation is no longer valid", async () => {
      await using tmp = await tmpdir()
      const home = path.join(tmp.path, "stale")
      await scaffoldDevEcoHome(home)

      await useStateDir(tmp.path)
      await saveDevEcoHome(home)
      await fs.rm(nodePath(home))

      expect(await loadSavedDevEcoHome()).toBeUndefined()
      expect(await loadSavedDevEcoHome()).toBeUndefined()
    })
  })

  describe("buildEnv()", () => {
    test("injects DEVECO_HOME and DEVECO_SDK_HOME into the returned environment", async () => {
      await using tmp = await tmpdir()
      const home = path.join(tmp.path, "deveco-env")
      const sdk = path.join(home, "sdk")
      await scaffoldDevEcoHome(home)

      const env = buildEnv(home, sdk)
      expect(env.DEVECO_HOME).toBe(home)
      expect(env.DEVECO_SDK_HOME).toBe(sdk)
      expect(env.PATH).toContain(path.join(home, "tools", "hvigor", "bin"))
    })
  })

  describe("path helpers", () => {
    test("nodePath() uses platform-specific node location", async () => {
      await using tmp = await tmpdir()
      const home = path.join(tmp.path, "paths")
      const expected =
        process.platform === "win32"
          ? path.join(home, "tools", "node", "node.exe")
          : path.join(home, "tools", "node", "bin", "node")
      expect(nodePath(home)).toBe(expected)
    })

    test("hvigorPath(), sdkPath(), and hdcPath() resolve under the home directory", async () => {
      await using tmp = await tmpdir()
      const home = path.join(tmp.path, "tool-paths")
      expect(hvigorPath(home)).toBe(path.join(home, "tools", "hvigor", "bin", "hvigorw.js"))
      expect(sdkPath(home)).toBe(path.join(home, "sdk"))
      const hdc = process.platform === "win32" ? "hdc.exe" : "hdc"
      expect(hdcPath(home)).toBe(path.join(home, "sdk", "default", "openharmony", "toolchains", hdc))
    })
  })

  describe("subdirectory descent", () => {
    test("resolves an install root nested below a shallow container", async () => {
      await using tmp = await tmpdir()
      const container = path.join(tmp.path, "DevEco Studio")
      const nested = path.join(container, "xin", "DevEco Studio")
      await scaffoldDevEcoHome(nested)
      expect(await resolveDevEcoHome(container)).toBe(nested)
    })

    test("prefers the declared path when it is already a valid root", async () => {
      await using tmp = await tmpdir()
      const outer = path.join(tmp.path, "outer")
      await scaffoldDevEcoHome(outer)
      await scaffoldDevEcoHome(path.join(outer, "xin", "DevEco Studio"))
      expect(await resolveDevEcoHome(outer)).toBe(outer)
    })

    test("never descends into toolchain folders that may hold a second copy", async () => {
      await using tmp = await tmpdir()
      const shallow = path.join(tmp.path, "shallow")
      await fs.mkdir(path.dirname(nodePath(shallow)), { recursive: true })
      await Bun.write(nodePath(shallow), "")
      await scaffoldDevEcoHome(path.join(shallow, "tools", "DevEco Studio"))
      expect(await resolveDevEcoHome(shallow)).toBeUndefined()
    })

    test("stops at the depth bound", async () => {
      await using tmp = await tmpdir()
      const container = path.join(tmp.path, "deep")
      await scaffoldDevEcoHome(path.join(container, "a", "b", "c", "DevEco Studio"))
      expect(await resolveDevEcoHome(container)).toBeUndefined()
    })
  })

  describe("validateHome()", () => {
    test("names the reason a declared path is unusable", async () => {
      await using tmp = await tmpdir()

      const noNode = path.join(tmp.path, "no-node")
      await fs.mkdir(noNode, { recursive: true })
      expect(await validateHome(noNode)).toEqual({ ok: false, reason: "NO_NODE" })

      const noProduct = path.join(tmp.path, "no-product")
      await fs.mkdir(path.dirname(nodePath(noProduct)), { recursive: true })
      await Bun.write(nodePath(noProduct), "")
      expect(await validateHome(noProduct)).toEqual({ ok: false, reason: "NO_PRODUCT_INFO" })

      const outdated = path.join(tmp.path, "outdated")
      await scaffoldDevEcoHome(outdated, "5.0.0")
      expect(await validateHome(outdated)).toEqual({ ok: false, reason: "BAD_VERSION" })

      expect(await validateHome(path.join(tmp.path, "absent"))).toEqual({ ok: false, reason: "MISSING_DIR" })
    })
  })

  describe("getDevEcoHome()", () => {
    test("keeps the rejected path when a saved home recovers from it", async () => {
      await using tmp = await tmpdir()
      const shallow = path.join(tmp.path, "shallow-config")
      await fs.mkdir(shallow, { recursive: true })
      const savedHome = path.join(tmp.path, "saved-home")
      await scaffoldDevEcoHome(savedHome)
      await useStateDir(tmp.path)
      await saveDevEcoHome(savedHome)

      await withDevecoHome(shallow, async () => {
        const outcome = await getDevEcoHome()
        expect(outcome.ok).toBe(true)
        if (!outcome.ok) return
        expect(outcome.home).toBe(savedHome)
        expect(outcome.source).toBe("saved")
        expect(outcome.rejections).toEqual([{ path: shallow, reason: "NO_NODE" }])
        expect(devEcoHomeWarning(outcome)).toContain(shallow)
      })
    })

    test("resolves a nested root straight from a shallow DEVECO_HOME", async () => {
      await using tmp = await tmpdir()
      const container = path.join(tmp.path, "DevEco Studio")
      const nested = path.join(container, "xin", "DevEco Studio")
      await scaffoldDevEcoHome(nested)
      await useStateDir(tmp.path)

      await withDevecoHome(container, async () => {
        const outcome = await getDevEcoHome()
        expect(outcome.ok && outcome.home).toBe(nested)
        expect(outcome.ok && outcome.source).toBe("env")
      })
    })

    test("reports no warning when the configured path was used as declared", async () => {
      await using tmp = await tmpdir()
      const home = path.join(tmp.path, "as-declared")
      await scaffoldDevEcoHome(home)
      await useStateDir(tmp.path)

      await withDevecoHome(home, async () => {
        const outcome = await getDevEcoHome()
        expect(outcome.ok && outcome.source).toBe("env")
        expect(devEcoHomeWarning(outcome)).toBeUndefined()
      })
    })

    test("memoizes one scan per DEVECO_HOME", async () => {
      await using tmp = await tmpdir()
      await useStateDir(tmp.path)
      const promises: ReturnType<typeof getDevEcoHome>[] = []
      await withDevecoHome(undefined, async () => {
        promises.push(getDevEcoHome(), getDevEcoHome())
      })
      await withDevecoHome(path.join(tmp.path, "another"), async () => {
        promises.push(getDevEcoHome())
      })
      expect(promises[1]).toBe(promises[0])
      expect(promises[2]).not.toBe(promises[0])
    })
  })

  describe("devEcoHomeMissingMessage()", () => {
    test("names the rejected path and the markers a root must carry", () => {
      const message = devEcoHomeMissingMessage({
        ok: false,
        rejections: [{ path: "D:\\DevEco Studio", reason: "NO_PRODUCT_INFO" }],
        tried: [],
      })
      expect(message).toContain("D:\\DevEco Studio")
      expect(message).toContain("product-info.json")
      expect(message).toContain("DEVECO_HOME")
    })

    test("lists the candidates it searched when nothing was configured", () => {
      const message = devEcoHomeMissingMessage({ ok: false, rejections: [], tried: ["C:\\a", "D:\\b"] })
      expect(message).toContain("Searched: C:\\a, D:\\b")
    })
  })

  describe("buildEnv() node directory", () => {
    test("puts the platform-specific node folder on PATH", async () => {
      await using tmp = await tmpdir()
      const home = path.join(tmp.path, "deveco-env-node")
      await scaffoldDevEcoHome(home)
      const nodeDir =
        process.platform === "win32" ? path.join(home, "tools", "node") : path.join(home, "tools", "node", "bin")
      expect(buildEnv(home, sdkPath(home)).PATH).toContain(nodeDir)
    })
  })
})
