import { describe, expect, test } from "bun:test"
import { customProviderForm, validateCustomProvider } from "./dialog-custom-provider-form"

const t = (key: string) => key

describe("validateCustomProvider", () => {
  test("initializes an edit form from a saved custom provider", () => {
    expect(
      customProviderForm({
        providerID: "custom-provider",
        config: {
          name: "Custom Provider",
          options: {
            baseURL: "https://api.example.com",
            headers: { "X-Test": "enabled" },
          },
          models: {
            "model-a": { name: "Model A" },
          },
        },
      }),
    ).toMatchObject({
      providerID: "custom-provider",
      name: "Custom Provider",
      baseURL: "https://api.example.com",
      apiKey: "",
      models: [{ id: "model-a", name: "Model A", contextWindow: "", maxOutput: "" }],
      headers: [{ key: "X-Test", value: "enabled" }],
      err: {},
    })
  })

  test("builds trimmed config payload", () => {
    const result = validateCustomProvider({
      form: {
        providerID: "custom-provider",
        name: " Custom Provider ",
        baseURL: "https://api.example.com ",
        apiKey: " {env: CUSTOM_PROVIDER_KEY} ",
        models: [{ row: "m0", id: " model-a ", name: " Model A ", contextWindow: "128000", maxOutput: "8192", err: {} }],
        headers: [
          { row: "h0", key: " X-Test ", value: " enabled ", err: {} },
          { row: "h1", key: "", value: "", err: {} },
        ],
        err: {},
      },
      t,
      disabledProviders: [],
      existingProviderIDs: new Set(),
    })

    expect(result.result).toEqual({
      providerID: "custom-provider",
      name: "Custom Provider",
      key: undefined,
      config: {
        npm: "@ai-sdk/openai-compatible",
        name: "Custom Provider",
        env: ["CUSTOM_PROVIDER_KEY"],
        options: {
          baseURL: "https://api.example.com",
          headers: {
            "X-Test": "enabled",
          },
        },
        models: {
          "model-a": { name: "Model A", limit: { context: 128000, output: 8192 } },
        },
      },
    })
  })

  test("flags duplicate rows and allows reconnecting disabled providers", () => {
    const result = validateCustomProvider({
      form: {
        providerID: "custom-provider",
        name: "Provider",
        baseURL: "https://api.example.com",
        apiKey: "secret",
        models: [
          { row: "m0", id: "model-a", name: "Model A", contextWindow: "", maxOutput: "", err: {} },
          { row: "m1", id: "model-a", name: "Model A 2", contextWindow: "", maxOutput: "", err: {} },
        ],
        headers: [
          { row: "h0", key: "Authorization", value: "one", err: {} },
          { row: "h1", key: "authorization", value: "two", err: {} },
        ],
        err: {},
      },
      t,
      disabledProviders: ["custom-provider"],
      existingProviderIDs: new Set(["custom-provider"]),
    })

    expect(result.result).toBeUndefined()
    expect(result.err.providerID).toBeUndefined()
    expect(result.models[1]).toEqual({
      id: "provider.custom.error.duplicate",
      name: undefined,
      contextWindow: undefined,
      maxOutput: undefined,
    })
    expect(result.headers[1]).toEqual({
      key: "provider.custom.error.duplicate",
      value: undefined,
    })
  })
})
