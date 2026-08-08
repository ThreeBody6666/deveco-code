import { describe, expect, test } from "bun:test"
import { WebSearchManager } from "./websearch-manager"

describe("WebSearchManager", () => {
  test("reports configured providers without exposing their keys", async () => {
    const manager = WebSearchManager.make({
      secrets: {
        get: async (provider) => (provider === "exa" ? "exa-secret" : undefined),
        set: async () => {},
      },
    })

    await manager.setEnabled(false)
    const status = await manager.status()

    expect(status).toEqual({ enabled: false, provider: "exa", exa: { configured: true }, parallel: { configured: false } })
    expect(JSON.stringify(status)).not.toContain("exa-secret")
  })
})
