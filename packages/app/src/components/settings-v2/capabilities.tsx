import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Icon } from "@opencode-ai/ui/icon"
import { For, Show, createMemo, createResource, onMount, type Component } from "solid-js"
import { createStore } from "solid-js/store"
import { usePlatform } from "@/context/platform"
import { useServerSDK } from "@/context/server-sdk"
import { useServerSync } from "@/context/server-sync"
import { useSettings } from "@/context/settings"
import { SettingsListV2 } from "./parts/list"
import "./settings-v2.css"

const SEARCH_SETTINGS_ID = "deveco-websearch"
const SEARCH_KEY_ID = (provider: "exa" | "parallel" | "bing" | "tavily") => `deveco-websearch-${provider}`

export const SettingsCapabilitiesV2: Component = () => {
  const serverSDK = useServerSDK()
  const serverSync = useServerSync()
  const platform = usePlatform()
  const settings = useSettings()
  const [state, setState] = createStore({
    enabled: true,
    provider: "exa" as "exa" | "parallel" | "bing" | "tavily",
    exaConfigured: false,
    parallelConfigured: false,
    bingConfigured: false,
    tavilyConfigured: false,
    exaKey: "",
    parallelKey: "",
    bingKey: "",
    tavilyKey: "",
    bingEndpoint: "https://api.bing.microsoft.com/v7.0/search",
    saving: false,
    mobileDeviceID: "",
    mobileEndpoint: "",
    mobileAutoReconnect: false,
    mobileSaved: false,
  })
  const [skills, { refetch }] = createResource(async () => {
    const response = await serverSDK().client.app.skills()
    return response.data ?? []
  })
  const managedPaths = createMemo(() => serverSync().data.config.skills?.paths ?? [])

  onMount(() => {
    const mobile = settings.mobile.preference()
    setState({
      mobileDeviceID: mobile.preferredDeviceID,
      mobileEndpoint: mobile.endpoint,
      mobileAutoReconnect: mobile.autoReconnect,
    })
    const saved = localStorage.getItem(SEARCH_SETTINGS_ID)
    if (!saved) return
    try {
      const value = JSON.parse(saved) as Partial<typeof state>
      if (value.provider === "exa" || value.provider === "parallel" || value.provider === "bing" || value.provider === "tavily") setState("provider", value.provider)
      if (typeof value.enabled === "boolean") setState("enabled", value.enabled)
      if (typeof value.exaConfigured === "boolean") setState("exaConfigured", value.exaConfigured)
      if (typeof value.parallelConfigured === "boolean") setState("parallelConfigured", value.parallelConfigured)
      if (typeof value.bingConfigured === "boolean") setState("bingConfigured", value.bingConfigured)
      if (typeof value.tavilyConfigured === "boolean") setState("tavilyConfigured", value.tavilyConfigured)
      if (typeof value.bingEndpoint === "string") setState("bingEndpoint", value.bingEndpoint)
    } catch {}
  })

  const installLocal = async () => {
    if (platform.platform !== "desktop") return
    const selected = await platform.openDirectoryPickerDialog({ title: "选择包含 SKILL.md 的技能目录" })
    const location = Array.isArray(selected) ? selected[0] : selected
    if (!location || managedPaths().includes(location)) return
    await serverSync().updateConfig({
      ...serverSync().data.config,
      skills: { ...serverSync().data.config.skills, paths: [...managedPaths(), location] },
    })
    await refetch()
  }

  const removeLocal = async (location: string) => {
    await serverSync().updateConfig({
      ...serverSync().data.config,
      skills: { ...serverSync().data.config.skills, paths: managedPaths().filter((item) => item !== location) },
    })
    await refetch()
  }

  const saveSearch = async () => {
    setState("saving", true)
    try {
      const key = state.provider === "exa" ? state.exaKey.trim() : state.provider === "parallel" ? state.parallelKey.trim() : state.provider === "bing" ? state.bingKey.trim() : state.tavilyKey.trim()
      await serverSDK().client.auth.set({
        providerID: SEARCH_SETTINGS_ID,
        auth: { type: "api", key: "managed", metadata: { enabled: String(state.enabled), provider: state.provider, bing_endpoint: state.bingEndpoint.trim() } },
      })
      if (key) {
        await serverSDK().client.auth.set({ providerID: SEARCH_KEY_ID(state.provider), auth: { type: "api", key } })
        setState(state.provider === "exa" ? "exaConfigured" : state.provider === "parallel" ? "parallelConfigured" : state.provider === "bing" ? "bingConfigured" : "tavilyConfigured", true)
        setState(state.provider === "exa" ? "exaKey" : state.provider === "parallel" ? "parallelKey" : state.provider === "bing" ? "bingKey" : "tavilyKey", "")
      }
      localStorage.setItem(
        SEARCH_SETTINGS_ID,
        JSON.stringify({
          enabled: state.enabled,
          provider: state.provider,
          exaConfigured: state.exaConfigured,
          parallelConfigured: state.parallelConfigured,
          bingConfigured: state.bingConfigured,
          tavilyConfigured: state.tavilyConfigured,
          bingEndpoint: state.bingEndpoint,
        }),
      )
    } finally {
      setState("saving", false)
    }
  }

  const saveMobileDevice = () => {
    settings.mobile.save({
      preferredDeviceID: state.mobileDeviceID,
      endpoint: state.mobileEndpoint,
      autoReconnect: state.mobileAutoReconnect,
    })
    setState("mobileSaved", true)
  }

  const clearMobileDevice = () => {
    settings.mobile.clear()
    setState({
      mobileDeviceID: "",
      mobileEndpoint: "",
      mobileAutoReconnect: false,
      mobileSaved: false,
    })
  }

  return (
    <>
      <div class="settings-v2-tab-header settings-v2-capabilities-header">
        <div>
          <h2 class="settings-v2-tab-title">能力中心</h2>
          <p class="settings-v2-capabilities-subtitle">管理本地技能与联网搜索能力</p>
        </div>
        <ButtonV2 size="normal" variant="ghost-muted" onClick={() => void refetch()} disabled={skills.loading}>
          {skills.loading ? "刷新中" : "刷新"}
        </ButtonV2>
      </div>

      <div class="settings-v2-tab-body settings-v2-capabilities">
        <section class="settings-v2-section">
          <div class="settings-v2-capabilities-section-heading">
            <div>
              <h3 class="settings-v2-section-title">本地技能</h3>
              <p>选择包含 SKILL.md 的目录。保存后会在新会话中加载。</p>
            </div>
            <ButtonV2 size="normal" variant="neutral" icon="plus" onClick={() => void installLocal()}>
              添加目录
            </ButtonV2>
          </div>
          <SettingsListV2>
            <Show when={managedPaths().length} fallback={<div class="settings-v2-capabilities-status">尚未添加本地技能目录</div>}>
              <For each={managedPaths()}>
                {(location) => (
                  <div class="settings-v2-capability-row">
                    <div class="settings-v2-capability-icon" aria-hidden="true"><Icon name="brain" /></div>
                    <div class="settings-v2-capability-copy"><strong>受管理目录</strong><code title={location}>{location}</code></div>
                    <ButtonV2 size="small" variant="ghost-muted" onClick={() => void removeLocal(location)}>移除</ButtonV2>
                  </div>
                )}
              </For>
            </Show>
            <Show when={!skills.loading} fallback={<div class="settings-v2-capabilities-status">正在读取已加载技能</div>}>
              <For each={skills()}>
                {(skill) => (
                  <div class="settings-v2-capability-row">
                    <div class="settings-v2-capability-icon" aria-hidden="true"><Icon name="brain" /></div>
                    <div class="settings-v2-capability-copy"><strong>{skill.name}</strong><span>{skill.description ?? "未提供说明"}</span><code title={skill.location}>{skill.location}</code></div>
                    <span class="settings-v2-capability-status-badge">已加载</span>
                  </div>
                )}
              </For>
            </Show>
          </SettingsListV2>
        </section>

        <section class="settings-v2-section">
          <div class="settings-v2-capabilities-section-heading">
            <div>
              <h3 class="settings-v2-section-title">手机连接</h3>
              <p>保存默认设备 ID 后，后续连接会优先恢复到这台设备。设备离线时保留配置，重新上线后自动重连。</p>
            </div>
          </div>
          <SettingsListV2>
            <label class="settings-v2-search-key">
              <span>设备 ID</span>
              <input
                type="text"
                autocomplete="off"
                placeholder="连接成功后由手机端提供"
                value={state.mobileDeviceID}
                onInput={(event) => {
                  setState("mobileDeviceID", event.currentTarget.value)
                  setState("mobileSaved", false)
                }}
              />
            </label>
            <label class="settings-v2-search-key">
              <span>连接端点（可选）</span>
              <input
                type="url"
                autocomplete="off"
                placeholder="例如 https://192.168.1.8:8443"
                value={state.mobileEndpoint}
                onInput={(event) => {
                  setState("mobileEndpoint", event.currentTarget.value)
                  setState("mobileSaved", false)
                }}
              />
            </label>
            <label class="settings-v2-capabilities-switch">
              <input
                type="checkbox"
                checked={state.mobileAutoReconnect}
                disabled={!state.mobileDeviceID.trim()}
                onChange={(event) => {
                  setState("mobileAutoReconnect", event.currentTarget.checked)
                  setState("mobileSaved", false)
                }}
              />
              <span>启动后自动重连</span>
            </label>
            <div class="settings-v2-capabilities-actions">
              <span class="settings-v2-capability-status-badge">
                {state.mobileSaved || settings.mobile.preference().preferredDeviceID ? "已保存" : "未配置"}
              </span>
              <Show when={settings.mobile.preference().preferredDeviceID}>
                <ButtonV2 size="normal" variant="ghost-muted" onClick={clearMobileDevice}>清除</ButtonV2>
              </Show>
              <ButtonV2 size="normal" variant="neutral" onClick={saveMobileDevice} disabled={!state.mobileDeviceID.trim()}>
                保存设备
              </ButtonV2>
            </div>
          </SettingsListV2>
        </section>

        <section class="settings-v2-section">
          <div class="settings-v2-capabilities-section-heading">
            <div><h3 class="settings-v2-section-title">联网搜索</h3><p>选择服务并保存密钥后，智能体可在新会话中使用网页搜索。</p></div>
            <label class="settings-v2-capabilities-switch"><input type="checkbox" checked={state.enabled} onChange={(event) => setState("enabled", event.currentTarget.checked)} /><span>启用</span></label>
          </div>
          <SettingsListV2>
            <div class="settings-v2-search-provider">
              <label><input type="radio" name="websearch-provider" checked={state.provider === "exa"} onChange={() => setState("provider", "exa")} /> Exa</label>
              <label><input type="radio" name="websearch-provider" checked={state.provider === "parallel"} onChange={() => setState("provider", "parallel")} /> Parallel</label>
              <label><input type="radio" name="websearch-provider" checked={state.provider === "bing"} onChange={() => setState("provider", "bing")} /> Bing</label>
              <label><input type="radio" name="websearch-provider" checked={state.provider === "tavily"} onChange={() => setState("provider", "tavily")} /> Tavily</label>
            </div>
            <Show when={state.provider === "bing"}><label class="settings-v2-search-key"><span>Bing 搜索端点</span><input type="url" value={state.bingEndpoint} onInput={(event) => setState("bingEndpoint", event.currentTarget.value)} /></label></Show>
            <label class="settings-v2-search-key"><span>{state.provider === "exa" ? "Exa API Key" : state.provider === "parallel" ? "Parallel API Key" : state.provider === "bing" ? "Bing 订阅密钥" : "Tavily API Key"}</span><input type="password" autocomplete="off" placeholder="输入 API Key" value={state.provider === "exa" ? state.exaKey : state.provider === "parallel" ? state.parallelKey : state.provider === "bing" ? state.bingKey : state.tavilyKey} onInput={(event) => setState(state.provider === "exa" ? "exaKey" : state.provider === "parallel" ? "parallelKey" : state.provider === "bing" ? "bingKey" : "tavilyKey", event.currentTarget.value)} /></label>
            <div class="settings-v2-capabilities-actions"><span class="settings-v2-capability-status-badge">{(state.provider === "exa" ? state.exaConfigured : state.provider === "parallel" ? state.parallelConfigured : state.provider === "bing" ? state.bingConfigured : state.tavilyConfigured) ? "已配置" : "未配置"}</span><ButtonV2 size="normal" variant="neutral" onClick={() => void saveSearch()} disabled={state.saving}>{state.saving ? "保存中" : "保存配置"}</ButtonV2></div>
          </SettingsListV2>
        </section>
      </div>
    </>
  )
}
