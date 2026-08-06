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
  test("keeps dialog entry animation on the dialog surface instead of every settings region", () => {
    expect(css).not.toContain("animation: settings-v2-panel-in")
    expect(css).not.toContain("animation: settings-v2-content-in")
    expect(css).not.toContain("animation: settings-v2-nav-in")
    expect(css).not.toContain("@keyframes settings-v2-panel-in")
    expect(css).not.toContain("@keyframes settings-v2-content-in")
    expect(css).not.toContain("@keyframes settings-v2-nav-in")
  })

  test("keeps the footer from overlapping the navigation items", () => {
    expect(block(".settings-v2-nav-shell")).toContain("overflow: hidden")
    expect(block(".settings-v2-nav-main")).toContain("overflow-y: auto")
    expect(block(".settings-v2-nav-footer")).toContain("flex: none")
  })

  test("switches settings navigation to a compact horizontal rail on narrow screens", () => {
    const responsive = css.slice(css.indexOf("@media (max-width: 760px)"))

    expect(responsive).toContain('data-orientation="vertical"] {\n    flex-direction: column')
    expect(responsive).toContain('data-slot="tabs-v2-list"] {\n    width: 100%')
    expect(responsive).toContain("overflow-x: auto")
    expect(responsive).toContain("scrollbar-width: none")
    expect(responsive).toContain("border-right: 0")
    expect(responsive).toContain(".settings-v2-nav-group {\n    display: contents")
  })
})
