import { describe, expect, test } from "bun:test"
import { detectLocale, normalizeLocale } from "./language"
import { dict as zh } from "@/i18n/zh"

describe("language defaults", () => {
  test("uses Simplified Chinese when there is no browser language", () => {
    expect(detectLocale(undefined)).toBe("zh")
  })

  test("uses Simplified Chinese when browser language is not explicitly supported", () => {
    expect(detectLocale(["en-US"])).toBe("zh")
  })

  test("keeps Traditional Chinese when browser requests it", () => {
    expect(detectLocale(["zh-Hant-TW", "zh-CN"])).toBe("zht")
  })

  test("normalizes unknown stored locales to Simplified Chinese", () => {
    expect(normalizeLocale("unknown")).toBe("zh")
  })

  test("keeps visible desktop Chinese labels localized", () => {
    expect(zh["app.name.desktop"]).toBe("DevEco Code 桌面端")
    expect(zh["settings.general.row.terminalFont.title"]).toBe("终端字体")
    expect(zh["settings.general.row.terminalFont.description"]).toBe("自定义终端中使用的字体")
  })
})
