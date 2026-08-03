import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const source = readFileSync(fileURLToPath(new URL("./dialog.tsx", import.meta.url)), "utf8")

describe("dialog overlay close behavior", () => {
  test("does not close dialogs from the surrounding overlay click", () => {
    expect(source).not.toContain("onClick={() => close(id)}")
  })
})
