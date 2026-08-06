import { execFile } from "node:child_process"
import { promisify } from "node:util"

import {
  DEFAULT_DEVECO_STUDIO_WIN_PATHS,
  DEFAULT_DEVECO_STUDIO_MAC_PATHS,
  DEFAULT_DEVECO_STUDIO_LINUX_PATHS,
  detectDevEcoStudio,
  summarizeReport,
  installGuideFor,
  ENV_DOCTOR_COMPONENTS,
  type EnvDoctorComponentId,
  type EnvDoctorItem,
  type EnvDoctorReport,
  type EnvDoctorSummary,
  type InstallGuide,
} from "./detect"

export type EnvDoctorScanResult = {
  items: EnvDoctorReport
  summary: EnvDoctorSummary
  generatedAt: string
}

type ProbeResult = { status: "ok"; version?: string; path?: string; detail?: string } | { status: "missing"; detail?: string }

export type EnvDoctorDeps = {
  selfVersion: () => string
  resolveNode: () => Promise<ProbeResult>
  resolveDevEcoCli: () => Promise<ProbeResult>
  studioSearchPaths: () => readonly string[]
  readCustomStudioPath: () => Promise<string | undefined>
  writeCustomStudioPath?: (path: string | undefined) => Promise<void>
}

export type EnvDoctorController = {
  scan: () => Promise<EnvDoctorScanResult>
  setStudioPath: (path: string) => Promise<EnvDoctorScanResult>
  clearStudioPath: () => Promise<EnvDoctorScanResult>
  installGuide: (id: EnvDoctorComponentId) => InstallGuide
  components: () => readonly (typeof ENV_DOCTOR_COMPONENTS)[number][]
}

const toItem = (id: EnvDoctorComponentId, probe: ProbeResult): EnvDoctorItem => ({
  id,
  status: probe.status,
  version: probe.status === "ok" ? probe.version : undefined,
  path: probe.status === "ok" ? probe.path : undefined,
  detail: probe.detail,
})

export function createEnvDoctorController(deps: EnvDoctorDeps): EnvDoctorController {
  const scan = async (): Promise<EnvDoctorScanResult> => {
    const custom = await deps.readCustomStudioPath()
    const searchPaths = custom ? [custom, ...deps.studioSearchPaths()] : deps.studioSearchPaths()

    const [node, cli, studio] = await Promise.all([
      deps.resolveNode(),
      deps.resolveDevEcoCli(),
      detectDevEcoStudio(searchPaths),
    ])

    const items: EnvDoctorReport = [
      { id: "deveco-code", status: "ok", version: deps.selfVersion() },
      studio,
      toItem("deveco-cli", cli),
      toItem("node", node),
    ]

    return {
      items,
      summary: summarizeReport(items),
      generatedAt: new Date().toISOString(),
    }
  }

  return {
    scan,
    setStudioPath: async (path: string) => {
      await deps.writeCustomStudioPath?.(path)
      return scan()
    },
    clearStudioPath: async () => {
      await deps.writeCustomStudioPath?.(undefined)
      return scan()
    },
    installGuide: installGuideFor,
    components: () => ENV_DOCTOR_COMPONENTS,
  }
}

const execFileAsync = promisify(execFile)

async function probeExe(name: string, versionArgs: string[] = ["--version"]): Promise<ProbeResult> {
  try {
    const { stdout } = await execFileAsync(name, versionArgs, { shell: process.platform === "win32" })
    const version = (stdout ?? "").toString().trim().split(/\s+/)[0]
    return { status: "ok", version: version || undefined }
  } catch {
    return { status: "missing" }
  }
}

export function createDefaultEnvDoctorDeps(
  storageAccessors: {
    readCustomStudioPath: () => Promise<string | undefined>
    writeCustomStudioPath: (path: string | undefined) => Promise<void>
    selfVersion: () => string
  },
): EnvDoctorDeps {
  return {
    selfVersion: storageAccessors.selfVersion,
    resolveNode: () => probeExe("node"),
    resolveDevEcoCli: () => probeExe("devecocli"),
    studioSearchPaths: () => {
      if (process.platform === "win32") return DEFAULT_DEVECO_STUDIO_WIN_PATHS
      if (process.platform === "darwin") return DEFAULT_DEVECO_STUDIO_MAC_PATHS
      if (process.platform === "linux") return DEFAULT_DEVECO_STUDIO_LINUX_PATHS
      return []
    },
    readCustomStudioPath: storageAccessors.readCustomStudioPath,
    writeCustomStudioPath: storageAccessors.writeCustomStudioPath,
  }
}
