import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const source = readFileSync(fileURLToPath(new URL("./dialog-v2.tsx", import.meta.url)), "utf8")

describe("settings dialog close affordance", () => {
  test("renders a close button even when the settings dialog has no header", () => {
    expect(source).toContain('<Show when={hasHeader() || local.variant === "settings"}>')
    expect(source).toContain('<Kobalte.CloseButton data-slot="dialog-close-button" aria-label="Close">')
  })
})
