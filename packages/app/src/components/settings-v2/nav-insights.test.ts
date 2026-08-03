import { describe, expect, test } from "bun:test"
import { settingsNavInsights } from "./nav-insights"

describe("settings nav polish", () => {
  test("builds compact insight cards for the settings sidebar", () => {
    expect(settingsNavInsights("1.17.9")).toEqual([
      { id: "version", label: "当前版本", value: "v1.17.9" },
      { id: "layout", label: "界面风格", value: "工作台布局" },
      { id: "language", label: "显示语言", value: "中文优先" },
    ])
  })

  test("uses a fallback version when platform version is missing", () => {
    expect(settingsNavInsights(undefined)[0]).toEqual({ id: "version", label: "当前版本", value: "开发版" })
  })
})
