export type SettingsNavInsight = {
  id: "version" | "layout" | "language"
  label: string
  value: string
}

export function settingsNavInsights(version: string | undefined): SettingsNavInsight[] {
  return [
    { id: "version", label: "当前版本", value: version ? `v${version}` : "开发版" },
    { id: "layout", label: "界面风格", value: "工作台布局" },
    { id: "language", label: "显示语言", value: "中文优先" },
  ]
}
