export type EnvDoctorComponentId = "deveco-code" | "deveco-studio" | "deveco-cli" | "node"
export type EnvDoctorStatus = "ok" | "missing" | "outdated" | "unknown"

export type EnvDoctorRow = {
  id: EnvDoctorComponentId
  label: string
  status: EnvDoctorStatus
  version?: string
  path?: string
  detail?: string
  actionLabel: string
  actionKind: "install" | "installed" | "update" | "inspect"
}

export type EnvDoctorReport = {
  items: {
    id: EnvDoctorComponentId
    status: EnvDoctorStatus
    version?: string
    path?: string
    detail?: string
  }[]
  summary: {
    healthy: boolean
    missing: unknown[]
  }
  generatedAt: string
}

const LABELS: Record<EnvDoctorComponentId, string> = {
  "deveco-code": "DevEco Code",
  "deveco-studio": "DevEco Studio",
  "deveco-cli": "DevEco CLI",
  node: "Node.js",
}

const ORDER: EnvDoctorComponentId[] = ["deveco-code", "deveco-studio", "deveco-cli", "node"]

const actionFor = (status: EnvDoctorStatus): { label: string; kind: EnvDoctorRow["actionKind"] } => {
  switch (status) {
    case "ok":
      return { label: "已安装", kind: "installed" }
    case "outdated":
      return { label: "去升级", kind: "update" }
    case "unknown":
      return { label: "重新检测", kind: "inspect" }
    default:
      return { label: "一键安装", kind: "install" }
  }
}

export function toRows(report: EnvDoctorReport): EnvDoctorRow[] {
  const byId = new Map(report.items.map((i) => [i.id, i] as const))
  return ORDER.map((id) => {
    const item = byId.get(id) ?? { id, status: "unknown" as const }
    const action = actionFor(item.status)
    return {
      id,
      label: LABELS[id],
      status: item.status,
      version: item.version,
      path: item.path,
      detail: item.detail,
      actionLabel: action.label,
      actionKind: action.kind,
    }
  })
}

export function isFirstRunPending(storeValue: string | null | undefined): boolean {
  return !storeValue || storeValue.length === 0
}
