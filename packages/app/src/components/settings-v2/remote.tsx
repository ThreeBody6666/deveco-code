import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Icon } from "@opencode-ai/ui/icon"
import { Component, For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { generateQRSvg } from "./qr-lite"

type RemoteBridgeInfo = {
  port: number
  hostnames: string[]
  pairCode: string
  pairCodeExpiresAt: number
  pairUrls: string[]
}

type RemoteBridgeApi = {
  remoteBridgeInfo: () => Promise<RemoteBridgeInfo | null>
  remoteBridgeRegenerate: () => Promise<RemoteBridgeInfo | null>
  remoteBridgeSubscribe: (cb: (info: RemoteBridgeInfo) => void) => Promise<() => void>
}

function getApi() {
  return (window as Window & { api?: RemoteBridgeApi }).api
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function formatExpiry(timestamp: number, now: number) {
  const seconds = Math.max(0, Math.ceil((timestamp - now) / 1000))
  if (seconds === 0) return "正在更新"
  if (seconds < 60) return `${seconds} 秒后过期`
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟后过期`
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟后过期`
}

export const SettingsRemoteV2: Component = () => {
  const [info, setInfo] = createSignal<RemoteBridgeInfo>()
  const [error, setError] = createSignal("")
  const [loading, setLoading] = createSignal(true)
  const [refreshing, setRefreshing] = createSignal(false)
  const [copyState, setCopyState] = createSignal<"idle" | "copied" | "error">("idle")
  const [now, setNow] = createSignal(Date.now())
  let fetching = false
  let refreshedCode = ""
  let expiryTimer: ReturnType<typeof setInterval> | undefined
  let copyTimer: ReturnType<typeof setTimeout> | undefined
  let bridgeUnsubscribe: (() => void) | undefined
  let subscribeCancelled = false

  const loadInfo = async (showLoading = true) => {
    if (fetching) return
    fetching = true
    if (showLoading) setLoading(true)
    try {
      const api = getApi()
      if (!api) throw new Error("手机远程功能仅在桌面端可用")
      const data = await api.remoteBridgeInfo()
      if (!data) throw new Error("远程桥尚未就绪")
      setInfo(data)
      setError("")
    } catch (cause) {
      setInfo()
      setError(message(cause))
    } finally {
      fetching = false
      setLoading(false)
    }
  }

  const regenerate = async () => {
    if (refreshing()) return
    setRefreshing(true)
    setCopyState("idle")
    try {
      const api = getApi()
      if (!api) throw new Error("手机远程功能仅在桌面端可用")
      const data = await api.remoteBridgeRegenerate()
      if (!data) throw new Error("远程桥尚未就绪")
      refreshedCode = ""
      setInfo(data)
      setError("")
      setNow(Date.now())
    } catch (cause) {
      setError(message(cause))
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }

  const copyUrl = async () => {
    const url = info()?.pairUrls[0]
    if (!url) return
    clearTimeout(copyTimer)
    try {
      await navigator.clipboard.writeText(url)
      setCopyState("copied")
    } catch {
      setCopyState("error")
    }
    copyTimer = setTimeout(() => setCopyState("idle"), 2200)
  }

  onMount(() => {
    void loadInfo()
    expiryTimer = setInterval(() => {
      const time = Date.now()
      setNow(time)
      const current = info()
      if (!current || current.pairCodeExpiresAt > time || refreshedCode === current.pairCode) return
      refreshedCode = current.pairCode
      void loadInfo(false)
    }, 1000)
    const api = getApi()
    if (!api?.remoteBridgeSubscribe) return
    void api.remoteBridgeSubscribe((data) => {
      refreshedCode = ""
      setInfo(data)
      setNow(Date.now())
    }).then((unsubscribe) => {
      if (subscribeCancelled) unsubscribe()
      else bridgeUnsubscribe = unsubscribe
    })
  })

  onCleanup(() => {
    subscribeCancelled = true
    clearInterval(expiryTimer)
    clearTimeout(copyTimer)
    bridgeUnsubscribe?.()
  })

  const readyInfo = createMemo(() => (error() ? undefined : info()))
  const qrData = createMemo(() => readyInfo()?.pairUrls[0])
  const expiry = createMemo(() => {
    const current = readyInfo()
    return current ? formatExpiry(current.pairCodeExpiresAt, now()) : ""
  })
  const expiringSoon = createMemo(() => {
    const current = readyInfo()
    return current ? current.pairCodeExpiresAt - now() < 60_000 : false
  })

  return (
    <>
      <header class="settings-v2-tab-header settings-v2-remote-header">
        <div class="settings-v2-remote-heading">
          <div class="settings-v2-remote-heading-icon" aria-hidden="true">
            <Icon name="speech-bubble" />
          </div>
          <div>
            <h2 class="settings-v2-tab-title">手机远程</h2>
            <p class="settings-v2-remote-subtitle">局域网桥接与配对状态</p>
          </div>
        </div>
      </header>

      <main class="settings-v2-tab-body settings-v2-remote" aria-busy={loading()}>
        <Show when={loading() && !info()}>
          <div class="settings-v2-remote-loading" role="status">
            <span class="settings-v2-remote-spinner" aria-hidden="true" />
            <div>
              <strong>正在连接远程桥</strong>
              <span>获取本机网络与配对信息</span>
            </div>
          </div>
        </Show>

        <Show when={error()}>
          <section class="settings-v2-remote-error" role="alert">
            <div class="settings-v2-remote-error-icon" aria-hidden="true">
              <Icon name="warning" />
            </div>
            <div class="settings-v2-remote-error-copy">
              <strong>远程桥不可用</strong>
              <span>{error()}</span>
            </div>
            <ButtonV2 variant="neutral" onClick={() => void loadInfo()} disabled={loading()}>
              重试
            </ButtonV2>
          </section>
        </Show>

        <Show when={readyInfo()}>
          {(bridge) => (
            <>
              <section class="settings-v2-remote-status" aria-label="远程桥状态">
                <div class="settings-v2-remote-status-main">
                  <span class="settings-v2-remote-status-dot" aria-hidden="true" />
                  <div>
                    <strong>局域网桥已就绪</strong>
                    <span>{bridge().hostnames.length} 个可用地址</span>
                  </div>
                </div>
                <span
                  class="settings-v2-remote-expiry"
                  data-warning={expiringSoon() ? "" : undefined}
                  aria-live="polite"
                >
                  {expiry()}
                </span>
              </section>

              <section class="settings-v2-remote-stage" aria-labelledby="remote-pair-title">
                <div class="settings-v2-remote-qr-column">
                  <div
                    class="settings-v2-remote-qr"
                    role="img"
                    aria-label="手机远程配对二维码"
                    innerHTML={qrData() ? generateQRSvg(qrData()!, 232) : ""}
                  />
                  <span>扫码配对</span>
                </div>

                <div class="settings-v2-remote-details">
                  <div class="settings-v2-remote-code-block">
                    <span class="settings-v2-remote-label" id="remote-pair-title">
                      配对码
                    </span>
                    <strong class="settings-v2-remote-code">{bridge().pairCode}</strong>
                  </div>

                  <div class="settings-v2-remote-addresses">
                    <span class="settings-v2-remote-label">主机地址</span>
                    <div class="settings-v2-remote-address-list">
                      <For each={bridge().hostnames}>
                        {(host) => <code>{host}:{bridge().port}</code>}
                      </For>
                    </div>
                  </div>

                  <Show when={qrData()}>
                    <div class="settings-v2-remote-link">
                      <div>
                        <span class="settings-v2-remote-label">连接地址</span>
                        <code title={qrData()}>{qrData()}</code>
                      </div>
                      <button
                        type="button"
                        class="settings-v2-remote-copy"
                        onClick={() => void copyUrl()}
                        aria-label={copyState() === "copied" ? "连接地址已复制" : "复制连接地址"}
                      >
                        <Icon name={copyState() === "copied" ? "check" : "copy"} />
                      </button>
                    </div>
                    <span class="settings-v2-remote-copy-status" aria-live="polite">
                      {copyState() === "copied" ? "连接地址已复制" : copyState() === "error" ? "复制失败" : ""}
                    </span>
                  </Show>
                </div>
              </section>

              <footer class="settings-v2-remote-footer">
                <ButtonV2
                  class="settings-v2-remote-refresh"
                  variant="neutral"
                  icon="reset"
                  disabled={refreshing()}
                  onClick={() => void regenerate()}
                >
                  {refreshing() ? "正在生成" : "重新生成配对码"}
                </ButtonV2>
                <span>配对码会在连接成功或到期后自动轮换</span>
              </footer>
            </>
          )}
        </Show>
      </main>
    </>
  )
}
