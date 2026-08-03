import { createMemo, createSignal, Component, Show, For, onMount, onCleanup } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import { generateQRSvg } from "./qr-lite"

type RemoteBridgeInfo = {
  port: number
  hostnames: string[]
  pairCode: string
  pairCodeExpiresAt: number
  pairUrls: string[]
}

function getApi() {
  return (window as any).api as {
    remoteBridgeInfo: () => Promise<RemoteBridgeInfo | null>
    remoteBridgeRegenerate: () => Promise<RemoteBridgeInfo | null>
  } | undefined
}

function formatExpiry(ts: number): string {
  const d = new Date(ts)
  const now = Date.now()
  const min = Math.max(0, Math.round((ts - now) / 60000))
  if (min < 1) return "即将过期"
  if (min < 60) return `${min} 分钟后过期`
  return `${Math.floor(min / 60)} 小时 ${min % 60} 分钟后过期`
}

export const SettingsRemoteV2: Component = () => {
  const [info, setInfo] = createSignal<RemoteBridgeInfo | null>(null)
  const [error, setError] = createSignal("")
  const [loading, setLoading] = createSignal(true)
  let timer: ReturnType<typeof setInterval>

  const fetchInfo = async () => {
    const api = getApi()
    if (!api) {
      setError("仅桌面端可用")
      setLoading(false)
      return
    }
    try {
      const data = await api.remoteBridgeInfo()
      setInfo(data)
      setError("")
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  onMount(() => {
    fetchInfo()
    timer = setInterval(() => {
      if (info()) {
        const remaining = (info()!.pairCodeExpiresAt - Date.now()) / 1000
        if (remaining <= 0) fetchInfo()
      }
    }, 5000)
  })

  onCleanup(() => clearInterval(timer))

  const qrData = createMemo(() => {
    const i = info()
    if (!i || !i.pairUrls.length) return null
    return i.pairUrls[0]
  })

  return (
    <div class="flex flex-col gap-6 p-4" style="max-width: 560px">
      <div class="flex flex-col gap-2">
        <h2 class="text-lg font-semibold text-gray-900">手机远程</h2>
        <p class="text-sm text-gray-500">
          手机端 DevEco Code 通过局域网连接到电脑，查看会话和发送消息给 Agent。
        </p>
      </div>

      <Show when={loading()}>
        <div class="flex items-center gap-2 text-sm text-gray-400">
          <Icon name="cloud-upload" class="animate-spin" />
          正在获取配对信息…
        </div>
      </Show>

      <Show when={error()}>
        <div class="flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <div class="flex items-center gap-2">
            <Icon name="circle-ban-sign" class="text-red-500" />
            <span class="text-sm font-medium text-red-700">远程桥未启动</span>
          </div>
          <p class="text-xs text-red-600">
            {error() === "仅桌面端可用"
              ? "手机远程功能仅在 DevEco Code 桌面端可用。"
              : "请确认 DevEco Code 已完全启动（服务就绪后会自动重启远程桥）。"}
          </p>
        </div>
      </Show>

      <Show when={info() && !error()}>
        <div class="flex flex-col gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          {/* IP 信息 */}
          <div class="flex flex-col gap-2">
            <span class="text-xs font-medium uppercase tracking-wide text-gray-400">主机地址</span>
            <div class="flex flex-wrap gap-2">
              <For each={info()!.hostnames}>
                {(host) => (
                  <span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-mono text-blue-700">
                    {host}:{info()!.port}
                  </span>
                )}
              </For>
            </div>
          </div>

          {/* 配对码 */}
          <div class="flex flex-col gap-2">
            <span class="text-xs font-medium uppercase tracking-wide text-gray-400">配对码</span>
            <div class="flex items-center gap-4">
              <span
                class="rounded-lg bg-gray-50 px-6 py-2.5 text-3xl font-bold tracking-[0.3em] text-gray-900 font-mono"
                style="letter-spacing: 0.3em"
              >
                {info()!.pairCode}
              </span>
              <span class="text-xs text-gray-400">{formatExpiry(info()!.pairCodeExpiresAt)}</span>
            </div>
          </div>

          {/* Pair URL + QR */}
          <Show when={qrData()}>
            <div class="flex flex-col gap-3">
              <span class="text-xs font-medium uppercase tracking-wide text-gray-400">
                扫码配对（推荐）
              </span>
              <div class="flex items-start gap-4">
                <div
                  class="rounded-lg border border-gray-100 bg-white p-2"
                  style="width: 260px; height: 260px; display: flex; align-items: center; justify-content: center;"
                  innerHTML={generateQRSvg(qrData()!, 240)}
                />
                <div class="flex flex-1 flex-col gap-2 pt-1">
                  <p class="text-xs text-gray-500">手机端：</p>
                  <ol class="list-inside list-decimal space-y-0.5 text-xs text-gray-500">
                    <li>打开手机 DevEco Code</li>
                    <li>点扫码配对，对准这个二维码</li>
                    <li>或复制下面的 URL 手动填入</li>
                  </ol>
                  <div class="mt-1 flex items-center gap-2">
                    <code class="flex-1 truncate rounded-lg bg-gray-50 px-3 py-1.5 text-[11px] text-gray-700 font-mono">
                      {qrData()}
                    </code>
                    <button
                      class="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                      onClick={() => {
                        const s = qrData()
                        if (s) navigator.clipboard.writeText(s)
                      }}
                    >
                      复制
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Show>
        </div>

        {/* 重新生成 */}
        <div class="flex items-center gap-2">
          <button
            class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50 active:bg-gray-100"
            onClick={async () => {
              setLoading(true)
              setError("")
              const api = getApi()
              if (!api) return
              try {
                const data = await api.remoteBridgeRegenerate()
                setInfo(data)
              } catch (e: any) {
                setError(e?.message ?? String(e))
              } finally {
                setLoading(false)
              }
            }}
          >
            <Icon name="arrow-undo-down" class="h-3.5 w-3.5" />
            重新生成配对码
          </button>
          <span class="text-xs text-gray-400">配对成功后自动轮换，也可手动刷新。</span>
        </div>
      </Show>
    </div>
  )
}