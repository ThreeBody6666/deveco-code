import { describe, expect, test } from "bun:test"
import { appIdentity } from "./app-identity"

describe("appIdentity", () => {
  test("uses a new DevEco shell identity while preserving the existing data directory", () => {
    expect(appIdentity("dev", true)).toEqual({
      dataId: "ai.opencode.desktop.dev",
      shellId: "ai.deveco.code.desktop.dev",
    })
  })

  test("keeps unpackaged development data compatible", () => {
    expect(appIdentity("prod", false)).toEqual({
      dataId: "ai.opencode.desktop.dev",
      shellId: "ai.deveco.code.desktop.dev",
    })
  })
})
