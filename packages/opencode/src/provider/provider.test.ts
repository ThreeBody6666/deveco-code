import { expect, test } from "bun:test"
import { toPublicInfo } from "./provider"

test("toPublicInfo does not throw when a provider catalog entry is missing", () => {
  expect(toPublicInfo(undefined as never)).toBeUndefined()
})
