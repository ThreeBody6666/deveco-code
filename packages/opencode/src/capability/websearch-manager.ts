export namespace WebSearchManager {
  export type Provider = "exa" | "parallel"

  export type Options = {
    secrets: {
      get(provider: Provider): Promise<string | undefined>
      set(provider: Provider, value: string | undefined): Promise<void>
    }
  }

  export function make(options: Options) {
    let enabled = true
    let provider: Provider = "exa"

    return {
      async status() {
        const [exa, parallel] = await Promise.all([options.secrets.get("exa"), options.secrets.get("parallel")])
        return {
          enabled,
          provider,
          exa: { configured: exa !== undefined && exa.length > 0 },
          parallel: { configured: parallel !== undefined && parallel.length > 0 },
        }
      },
      async setEnabled(value: boolean) {
        enabled = value
      },
      async setProvider(value: Provider) {
        provider = value
      },
      async setKey(value: Provider, key: string | undefined) {
        await options.secrets.set(value, key)
      },
    }
  }
}
