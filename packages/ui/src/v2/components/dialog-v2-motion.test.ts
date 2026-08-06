import { describe, expect, test } from "bun:test"

const css = await Bun.file(new URL("./dialog-v2.css", import.meta.url)).text()

function block(selector: string) {
  const start = css.indexOf(selector)
  expect(start).toBeGreaterThanOrEqual(0)
  const open = css.indexOf("{", start)
  const close = css.indexOf("}", open)
  return css.slice(open + 1, close)
}

describe("dialog motion performance", () => {
  test("avoids live backdrop blur on the full viewport overlay", () => {
    expect(block('[data-component="dialog-overlay"]')).not.toContain("backdrop-filter")
  })

  test("does not scale the shadowed dialog surface while it enters", () => {
    const keyframes = css.slice(css.indexOf("@keyframes dialog-v2-content-in"))
    expect(keyframes).not.toContain("scale(")
  })
})
