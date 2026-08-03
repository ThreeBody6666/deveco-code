import { describe, expect, test } from "bun:test"
import { DESKTOP_MENU } from "./desktop-menu"

describe("desktop menu localization", () => {
  test("uses Chinese labels for visible desktop menus", () => {
    expect(DESKTOP_MENU.map((menu) => menu.label)).toEqual(["DevEco Code", "文件", "编辑", "视图", "导航", "窗口", "帮助"])
  })

  test("uses Chinese labels for common desktop menu actions", () => {
    const file = DESKTOP_MENU.find((menu) => menu.id === "file")
    const view = DESKTOP_MENU.find((menu) => menu.id === "view")
    const help = DESKTOP_MENU.find((menu) => menu.id === "help")

    expect(file?.items?.filter((entry) => entry.type === "item").map((entry) => entry.label)).toContain("新建会话")
    expect(view?.items?.filter((entry) => entry.type === "item").map((entry) => entry.label)).toContain("切换开发者工具")
    expect(help?.items?.filter((entry) => entry.type === "item").map((entry) => entry.label)).toContain("报告问题")
  })
})
