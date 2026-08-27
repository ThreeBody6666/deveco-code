const PROVIDER_ID = /^[a-z0-9][a-z0-9-_]*$/
const OPENAI_COMPATIBLE = "@ai-sdk/openai-compatible"
const DEFAULT_CONTEXT_WINDOW = 32_768
const DEFAULT_MAX_OUTPUT = 8_192

type Translator = (key: string, vars?: Record<string, string | number | boolean>) => string

export type ModelErr = {
  id?: string
  name?: string
  contextWindow?: string
  maxOutput?: string
}

export type HeaderErr = {
  key?: string
  value?: string
}

export type ModelRow = {
  row: string
  id: string
  name: string
  contextWindow: string
  maxOutput: string
  err: ModelErr
}

export type HeaderRow = {
  row: string
  key: string
  value: string
  err: HeaderErr
}

export type FormState = {
  providerID: string
  name: string
  baseURL: string
  apiKey: string
  models: ModelRow[]
  headers: HeaderRow[]
  err: {
    providerID?: string
    name?: string
    baseURL?: string
  }
}

export type EditableCustomProvider = {
  providerID: string
  config: {
    name?: string
    options?: {
      baseURL?: string
      headers?: Record<string, string>
    }
    models?: Record<string, { name?: string; limit?: { context?: number; output?: number } }>
  }
}

type ValidateArgs = {
  form: FormState
  t: Translator
  disabledProviders: string[]
  existingProviderIDs: Set<string>
}

export function customProviderForm(provider?: EditableCustomProvider): FormState {
  const models = Object.entries(provider?.config.models ?? {}).map(([id, model]) => ({
    row: nextRow(),
    id,
    name: model.name ?? id,
    contextWindow: model.limit?.context?.toString() ?? "",
    maxOutput: model.limit?.output?.toString() ?? "",
    err: {},
  }))
  const headers = Object.entries(provider?.config.options?.headers ?? {}).map(([key, value]) => ({
    row: nextRow(),
    key,
    value,
    err: {},
  }))

  return {
    providerID: provider?.providerID ?? "",
    name: provider?.config.name ?? "",
    baseURL: provider?.config.options?.baseURL ?? "",
    apiKey: "",
    models: models.length ? models : [modelRow()],
    headers: headers.length ? headers : [headerRow()],
    err: {},
  }
}

export function validateCustomProvider(input: ValidateArgs) {
  const providerID = input.form.providerID.trim()
  const name = input.form.name.trim()
  const baseURL = input.form.baseURL.trim()
  const apiKey = input.form.apiKey.trim()

  const env = apiKey.match(/^\{env:([^}]+)\}$/)?.[1]?.trim()
  const key = apiKey && !env ? apiKey : undefined

  const idError = !providerID
    ? input.t("provider.custom.error.providerID.required")
    : !PROVIDER_ID.test(providerID)
      ? input.t("provider.custom.error.providerID.format")
      : undefined

  const nameError = !name ? input.t("provider.custom.error.name.required") : undefined
  const urlError = !baseURL
    ? input.t("provider.custom.error.baseURL.required")
    : !/^https?:\/\//.test(baseURL)
      ? input.t("provider.custom.error.baseURL.format")
      : undefined

  const disabled = input.disabledProviders.includes(providerID)
  const existsError = idError
    ? undefined
    : input.existingProviderIDs.has(providerID) && !disabled
      ? input.t("provider.custom.error.providerID.exists")
      : undefined

  const seenModels = new Set<string>()
  const models = input.form.models.map((m) => {
    const id = m.id.trim()
    const idError = !id
      ? input.t("provider.custom.error.required")
      : seenModels.has(id)
        ? input.t("provider.custom.error.duplicate")
        : (() => {
            seenModels.add(id)
            return undefined
          })()
    const nameError = !m.name.trim() ? input.t("provider.custom.error.required") : undefined
    const contextWindow = parseOptionalTokenLimit(m.contextWindow)
    const maxOutput = parseOptionalTokenLimit(m.maxOutput)
    return {
      id: idError,
      name: nameError,
      contextWindow: contextWindow === "invalid" ? input.t("provider.custom.error.positiveInteger") : undefined,
      maxOutput: maxOutput === "invalid" ? input.t("provider.custom.error.positiveInteger") : undefined,
    }
  })
  const modelsValid = models.every((m) => !m.id && !m.name && !m.contextWindow && !m.maxOutput)
  const modelConfig = Object.fromEntries(
    input.form.models.map((m) => {
      const context = parseOptionalTokenLimit(m.contextWindow)
      const output = parseOptionalTokenLimit(m.maxOutput)
      const hasLimit = typeof context === "number" || typeof output === "number"
      // The config contract requires both values when a limit is specified.
      // Keep the other field at the app default when the user overrides only one.
      const limit = hasLimit
        ? { context: typeof context === "number" ? context : DEFAULT_CONTEXT_WINDOW, output: typeof output === "number" ? output : DEFAULT_MAX_OUTPUT }
        : undefined
      return [m.id.trim(), { name: m.name.trim(), ...(limit ? { limit } : {}) }]
    }),
  )

  const seenHeaders = new Set<string>()
  const headers = input.form.headers.map((h) => {
    const key = h.key.trim()
    const value = h.value.trim()

    if (!key && !value) return {}
    const keyError = !key
      ? input.t("provider.custom.error.required")
      : seenHeaders.has(key.toLowerCase())
        ? input.t("provider.custom.error.duplicate")
        : (() => {
            seenHeaders.add(key.toLowerCase())
            return undefined
          })()
    const valueError = !value ? input.t("provider.custom.error.required") : undefined
    return { key: keyError, value: valueError }
  })
  const headersValid = headers.every((h) => !h.key && !h.value)
  const headerConfig = Object.fromEntries(
    input.form.headers
      .map((h) => ({ key: h.key.trim(), value: h.value.trim() }))
      .filter((h) => !!h.key && !!h.value)
      .map((h) => [h.key, h.value]),
  )

  const err = {
    providerID: idError ?? existsError,
    name: nameError,
    baseURL: urlError,
  }

  const ok = !idError && !existsError && !nameError && !urlError && modelsValid && headersValid
  if (!ok) return { err, models, headers }

  return {
    err,
    models,
    headers,
    result: {
      providerID,
      name,
      key,
      config: {
        npm: OPENAI_COMPATIBLE,
        name,
        ...(env ? { env: [env] } : {}),
        options: {
          baseURL,
          ...(Object.keys(headerConfig).length ? { headers: headerConfig } : {}),
        },
        models: modelConfig,
      },
    },
  }
}

let row = 0

const nextRow = () => `row-${row++}`

const parseOptionalTokenLimit = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const number = Number(trimmed)
  return Number.isSafeInteger(number) && number > 0 ? number : "invalid"
}

export const modelRow = (): ModelRow => ({ row: nextRow(), id: "", name: "", contextWindow: "", maxOutput: "", err: {} })
export const headerRow = (): HeaderRow => ({ row: nextRow(), key: "", value: "", err: {} })
