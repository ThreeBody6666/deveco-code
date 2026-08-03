import { Component, createResource, createSignal, For, Show } from "solid-js"
import { Dialog } from "@opencode-ai/ui/v2/dialog-v2"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { usePlatform } from "@/context/platform"
import { toRows, type EnvDoctorRow, type EnvDoctorComponentId } from "./report"
import "./env-doctor.css"

type DesktopEnvDoctorAPI = {
  scan: () => Promise<unknown>
  setStudioPath: (path: string) => Promise<unknown>
  openInstall: (id: string) => Promise<unknown>
}

function getEnvDoctorApi(): DesktopEnvDoctorAPI | undefined {
  const api = (globalThis as { api?: { envDoctor?: DesktopEnvDoctorAPI } }).api
  return api?.envDoctor
}

function pickDirectory(): Promise<string | null> {
  const api = (globalThis as { api?: { openDirectoryPicker?: (opts?: unknown) => Promise<string | string[] | null> } }).api
  const picker = api?.openDirectoryPicker
  if (!picker) return Promise.resolve(null)
  return picker({ title: "选择 DevEco Studio 安装目录" }).then((r) => (typeof r === "string" ? r : null))
}

export const DialogEnvDoctor: Component = () => {
  const platform = usePlatform()
  const envDoctor = getEnvDoctorApi()
  const [refreshTick, setRefreshTick] = createSignal(0)
  const [busy, setBusy] = createSignal<EnvDoctorComponentId | null>(null)

  const [report] = createResource(refreshTick, async () => {
    if (!envDoctor) return null
    return (await envDoctor.scan()) as { items: unknown[]; summary: { healthy: boolean } }
  })

  const rows = (): EnvDoctorRow[] => {
    const r = report()
    if (!r) return []
    return toRows(r as never)
  }

  const rescan = () => setRefreshTick((t) => t + 1)

  const handleAction = async (row: EnvDoctorRow) => {
    if (!envDoctor) return
    setBusy(row.id)
    try {
      if (row.id === "deveco-studio" && row.status !== "ok") {
        const picked = await pickDirectory()
        if (picked) {
          await envDoctor.setStudioPath(picked)
          rescan()
          return
        }
      }
      if (row.actionKind === "install" || row.actionKind === "update") {
        await envDoctor.openInstall(row.id)
      }
    } finally {
      setBusy(null)
      rescan()
    }
  }

  return (
    <Dialog size="normal" variant="settings" class="env-doctor-dialog">
      <div class="env-doctor-hero">
        <div class="env-doctor-hero-icon">
          <Icon name="sliders" />
        </div>
        <div class="env-doctor-hero-copy">
          <div class="env-doctor-hero-kicker">Environment</div>
          <div class="env-doctor-hero-title">一键环境检测</div>
          <div class="env-doctor-hero-desc">
            DevEco Code {platform.version} · 检查本机 HarmonyOS 开发所需的 DevEco Studio、CLI 和 Node.js
          </div>
        </div>
      </div>

      <Show
        when={!report.loading}
        fallback={<div class="env-doctor-empty">正在检测本机开发环境……</div>}
      >
        <Show when={!envDoctor}>
          <div class="env-doctor-empty">当前环境不支持自动检测（桌面 IPC 未就绪）</div>
        </Show>
        <div class="env-doctor-list">
          <For each={rows()}>
            {(row) => (
              <div class={`env-doctor-row env-doctor-row--${row.status}`}>
                <div class="env-doctor-row-body">
                  <div class="env-doctor-row-label">
                    <span class={`env-doctor-dot env-doctor-dot--${row.status}`} />
                    {row.label}
                  </div>
                  <div class="env-doctor-row-detail">
                    <Show when={row.version} fallback={<span>未检测到</span>}>
                      <span>{row.version}</span>
                    </Show>
                    <Show when={row.path}>
                      <span class="env-doctor-row-path" title={row.path}>
                        {row.path}
                      </span>
                    </Show>
                    <Show when={row.detail}>
                      <span class="env-doctor-row-detail-text">{row.detail}</span>
                    </Show>
                  </div>
                </div>
                <div class="env-doctor-row-actions">
                  <Show when={row.id === "deveco-studio" && row.status !== "ok"}>
                    <Button
                      variant="ghost"
                      size="small"
                      disabled={busy() === row.id}
                      onClick={() => handleAction(row)}
                    >
                      自定义位置
                    </Button>
                  </Show>
                  <Button
                    variant={row.actionKind === "installed" ? "ghost" : "primary"}
                    size="small"
                    disabled={row.actionKind === "installed" || busy() === row.id}
                    onClick={() => handleAction(row)}
                  >
                    {busy() === row.id ? "处理中…" : row.actionLabel}
                  </Button>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      <div class="env-doctor-footer">
        <Button variant="ghost" size="small" onClick={rescan}>
          重新检测
        </Button>
        <Show when={report()?.summary?.healthy}>
          <span class="env-doctor-ok-tag">环境就绪</span>
        </Show>
      </div>
    </Dialog>
  )
}
