import { Component } from "solid-js"
import { Dialog } from "@opencode-ai/ui/v2/dialog-v2"
import { TabsV2 } from "@opencode-ai/ui/v2/tabs-v2"
import { Icon } from "@opencode-ai/ui/icon"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { SettingsGeneralV2 } from "./general"
import { SettingsKeybinds } from "../settings-keybinds"
import { SettingsProvidersV2 } from "./providers"
import { SettingsModelsV2 } from "./models"
import "./settings-v2.css"
import { SettingsServersV2 } from "./servers"
import { SettingsRemoteV2 } from "./remote"
import { settingsNavInsights } from "./nav-insights"

export const DialogSettings: Component = () => {
  const language = useLanguage()
  const platform = usePlatform()
  const insights = () => settingsNavInsights(platform.version)

  return (
    <Dialog size="x-large" variant="settings" class="settings-v2-dialog">
      <TabsV2 orientation="vertical" variant="settings" defaultValue="general" class="settings-v2">
        <TabsV2.List>
          <div class="settings-v2-nav-shell">
            <div class="settings-v2-nav-main">
              <div class="settings-v2-nav-hero">
                <div class="settings-v2-nav-hero-icon">
                  <Icon name="sliders" />
                </div>
                <div class="settings-v2-nav-hero-copy">
                  <div class="settings-v2-nav-hero-kicker">Settings</div>
                  <div class="settings-v2-nav-hero-title">偏好设置</div>
                  <div class="settings-v2-nav-hero-description">调整桌面端体验、模型服务和快捷操作。</div>
                </div>
              </div>
              <div class="settings-v2-nav-insights">
                {insights().map((item) => (
                  <div class="settings-v2-nav-insight">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
              <div class="flex flex-col gap-3">
                <div class="flex flex-col gap-1.5">
                  <TabsV2.SectionTitle>{language.t("settings.section.desktop")}</TabsV2.SectionTitle>
                  <div class="flex flex-col gap-1.5 w-full">
                    <TabsV2.Trigger value="general">
                      <Icon name="sliders" />
                      {language.t("settings.tab.general")}
                    </TabsV2.Trigger>
                    <TabsV2.Trigger value="shortcuts">
                      <Icon name="keyboard" />
                      {language.t("settings.tab.shortcuts")}
                    </TabsV2.Trigger>
                    <TabsV2.Trigger value="remote">
                      <Icon name="speech-bubble" />
                      手机远程
                    </TabsV2.Trigger>
                  </div>
                </div>

                <div class="flex flex-col gap-1.5">
                  <TabsV2.SectionTitle>{language.t("settings.section.server")}</TabsV2.SectionTitle>
                  <div class="flex flex-col gap-1.5 w-full">
                    <TabsV2.Trigger value="servers">
                      <Icon name="server" />
                      {language.t("status.popover.tab.servers")}
                    </TabsV2.Trigger>
                    <TabsV2.Trigger value="providers">
                      <Icon name="providers" />
                      {language.t("settings.providers.title")}
                    </TabsV2.Trigger>
                    <TabsV2.Trigger value="models">
                      <Icon name="models" />
                      {language.t("settings.models.title")}
                    </TabsV2.Trigger>
                  </div>
                </div>
              </div>
            </div>
            <div class="settings-v2-nav-footer">
              <div class="settings-v2-nav-footer-card">
                <span>{language.t("app.name.desktop")}</span>
                <strong>本地桌面预览</strong>
              </div>
            </div>
          </div>
        </TabsV2.List>
        <TabsV2.Content value="general" class="settings-v2-panel">
          <SettingsGeneralV2 />
        </TabsV2.Content>
        <TabsV2.Content value="shortcuts" class="settings-v2-panel">
          <SettingsKeybinds v2 />
        </TabsV2.Content>
        <TabsV2.Content value="remote" class="settings-v2-panel">
          <SettingsRemoteV2 />
        </TabsV2.Content>
        <TabsV2.Content value="servers" class="settings-v2-panel">
          <SettingsServersV2 />
        </TabsV2.Content>
        <TabsV2.Content value="providers" class="settings-v2-panel">
          <SettingsProvidersV2 />
        </TabsV2.Content>
        <TabsV2.Content value="models" class="settings-v2-panel">
          <SettingsModelsV2 />
        </TabsV2.Content>
      </TabsV2>
    </Dialog>
  )
}
