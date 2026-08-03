import { describe, expect, test } from "bun:test"

const css = await Bun.file(new URL("./settings-v2.css", import.meta.url)).text()

function block(selector: string) {
  const start = css.indexOf(selector)
  expect(start).toBeGreaterThanOrEqual(0)
  const open = css.indexOf("{", start)
  const close = css.indexOf("}", open)
  return css.slice(open + 1, close)
}

describe("settings sidebar layout", () => {
  test("keeps the footer from overlapping the navigation items", () => {
    expect(block(".settings-v2-nav-shell")).toContain("overflow: hidden")
    expect(block(".settings-v2-nav-main")).toContain("overflow-y: auto")
    expect(block(".settings-v2-nav-footer")).toContain("flex: none")
  })
})
