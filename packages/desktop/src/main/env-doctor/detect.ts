import { access, readFile } from "node:fs/promises"
import { join } from "node:path"

export type EnvDoctorComponentId = "deveco-code" | "deveco-studio" | "deveco-cli" | "node"

export type EnvDoctorComponent = {
  id: EnvDoctorComponentId
  label: string
  required: boolean
}

export const ENV_DOCTOR_COMPONENTS: readonly EnvDoctorComponent[] = [
  { id: "deveco-code", label: "DevEco Code", required: true },
  { id: "deveco-studio", label: "DevEco Studio", required: true },
  { id: "deveco-cli", label: "DevEco CLI", required: true },
  { id: "node", label: "Node.js", required: true },
]

export const DEFAULT_DEVECO_STUDIO_WIN_PATHS: readonly string[] = [
  "C:\\Program Files\\Huawei\\DevEco Studio",
  "C:\\Program Files\\DevEco Studio",
  "C:\\Program Files (x86)\\DevEco Studio",
  "D:\\Huawei\\DevEco Studio",
  "D:\\DevEco Studio",
  "E:\\DevEco Studio",
]

export const MIN_DEVECO_STUDIO_VERSION = "6.0.0"

export type EnvDoctorItemStatus = "ok" | "missing" | "outdated" | "unknown"

export type EnvDoctorItem = {
  id: EnvDoctorComponentId
  status: EnvDoctorItemStatus
  version?: string
  path?: string
  detail?: string
}

export type EnvDoctorReport = EnvDoctorItem[]

export type EnvDoctorSummary = {
  healthy: boolean
  missing: EnvDoctorItem[]
}

export type InstallGuide = {
  url: string
  description: string
}

const OFFICIAL_INSTALL_GUIDES: Record<EnvDoctorComponentId, InstallGuide> = {
  "deveco-code": {
    url: "https://developer.huawei.com/consumer/cn/deveco-code/",
    description: "从华为开发者官网下载 DevEco Code 桌面端",
  },
  "deveco-studio": {
    url: "https://developer.huawei.com/consumer/cn/deveco-studio/",
    description: "从华为开发者官网下载 DevEco Studio 6.0 或以上",
  },
  "deveco-cli": {
    url: "https://www.npmjs.com/package/@deveco/deveco-cli",
    description: "使用 npm 全局安装 devecocli：npm install -g @deveco/deveco-cli@latest",
  },
  node: {
    url: "https://nodejs.org/zh-cn/download",
    description: "安装 Node.js LTS（推荐 22 或以上）",
  },
}

export function installGuideFor(id: EnvDoctorComponentId): InstallGuide {
  return OFFICIAL_INSTALL_GUIDES[id]
}

const exists = (path: string) =>
  access(path)
    .then(() => true)
    .catch(() => false)

function parseVersionTuple(version: string): number[] {
  return version
    .replace(/^[vV]/, "")
    .split(/[.\-+]/)
    .map((part) => {
      const n = Number.parseInt(part, 10)
      return Number.isFinite(n) ? n : 0
    })
}

export function compareVersions(a: string, b: string): number {
  const av = parseVersionTuple(a)
  const bv = parseVersionTuple(b)
  const len = Math.max(av.length, bv.length)
  for (let i = 0; i < len; i++) {
    const l = av[i] ?? 0
    const r = bv[i] ?? 0
    if (l !== r) return l < r ? -1 : 1
  }
  return 0
}

async function readProductInfoVersion(studioHome: string): Promise<string | undefined> {
  try {
    const raw = await readFile(join(studioHome, "product-info.json"), "utf8")
    const parsed = JSON.parse(raw) as { version?: string; buildNumber?: string }
    if (typeof parsed.version === "string") return parsed.version
    if (typeof parsed.buildNumber === "string") return parsed.buildNumber
  } catch {
    // ignore
  }
  return undefined
}

export async function detectDevEcoStudio(candidates: readonly string[]): Promise<EnvDoctorItem> {
  for (const candidate of candidates) {
    if (!(await exists(candidate))) continue
    const nodeDir = join(candidate, "tools", "node")
    if (!(await exists(nodeDir))) continue
    const version = await readProductInfoVersion(candidate)
    if (!version) {
      return { id: "deveco-studio", status: "unknown", path: candidate, detail: "product-info.json 不可读" }
    }
    if (compareVersions(version, MIN_DEVECO_STUDIO_VERSION) < 0) {
      return { id: "deveco-studio", status: "outdated", path: candidate, version }
    }
    return { id: "deveco-studio", status: "ok", path: candidate, version }
  }
  return { id: "deveco-studio", status: "missing" }
}

export function summarizeReport(report: EnvDoctorReport): EnvDoctorSummary {
  const requiredIds = new Set(ENV_DOCTOR_COMPONENTS.filter((c) => c.required).map((c) => c.id))
  const missing = report.filter((item) => requiredIds.has(item.id) && item.status !== "ok")
  return { healthy: missing.length === 0, missing }
}
