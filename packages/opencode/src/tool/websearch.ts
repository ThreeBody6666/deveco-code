import { Effect, Schema } from "effect"
import { HttpClient } from "effect/unstable/http"
import * as Tool from "./tool"
import * as McpWebSearch from "./mcp-websearch"
import DESCRIPTION from "./websearch.txt"
import { checksum } from "@opencode-ai/core/util/encode"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { Auth } from "@/auth"

export const Parameters = Schema.Struct({
  query: Schema.String.annotate({ description: "Websearch query" }),
  numResults: Schema.optional(Schema.Number).annotate({
    description: "Number of search results to return (default: 8)",
  }),
  livecrawl: Schema.optional(Schema.Literals(["fallback", "preferred"])).annotate({
    description:
      "Live crawl mode - 'fallback': use live crawling as backup if cached content unavailable, 'preferred': prioritize live crawling (default: 'fallback')",
  }),
  type: Schema.optional(Schema.Literals(["auto", "fast", "deep"])).annotate({
    description: "Search type - 'auto': balanced search (default), 'fast': quick results, 'deep': comprehensive search",
  }),
  contextMaxCharacters: Schema.optional(Schema.Number).annotate({
    description: "Maximum characters for context string optimized for LLMs (default: 10000)",
  }),
})

const WebSearchProviderSchema = Schema.Literals(["exa", "parallel", "bing", "tavily"])
export type WebSearchProvider = Schema.Schema.Type<typeof WebSearchProviderSchema>

export function selectWebSearchProvider(sessionID: string, flags = { exa: false, parallel: false }): WebSearchProvider {
  const override = process.env.DEVECO_WEBSEARCH_PROVIDER
  if (override === "exa" || override === "parallel") return override
  if (flags.parallel) return "parallel"
  if (flags.exa) return "exa"

  return Number.parseInt(checksum(sessionID) ?? "0", 36) % 2 === 0 ? "exa" : "parallel"
}

export function webSearchProviderLabel(provider: unknown) {
  if (provider === "parallel") return "Parallel Web Search"
  if (provider === "exa") return "Exa Web Search"
  if (provider === "bing") return "Bing Web Search"
  if (provider === "tavily") return "Tavily Web Search"
  return "Web Search"
}

export function webSearchModelName(extra: Tool.Context["extra"]) {
  const model = extra?.model
  if (!model || typeof model !== "object") return undefined
  const api = "api" in model && model.api && typeof model.api === "object" ? model.api : undefined
  const apiID = api && "id" in api && typeof api.id === "string" ? api.id : undefined
  const id = "id" in model && typeof model.id === "string" ? model.id : undefined
  return (apiID ?? id)?.slice(0, 100)
}

function authHeaders(key?: string) {
  const headers = { "User-Agent": `opencode/${InstallationVersion}` }
  if (!key) return headers
  return { ...headers, Authorization: `Bearer ${key}` }
}

function searchText(data: unknown) {
  if (!data || typeof data !== "object") return "No search results found. Please try a different query."
  const record = data as Record<string, unknown>
  const answer = typeof record.answer === "string" ? record.answer : ""
  const webPages = record.webPages && typeof record.webPages === "object" ? record.webPages as Record<string, unknown> : undefined
  const results = Array.isArray(record.results) ? record.results : Array.isArray(webPages?.value) ? webPages.value : []
  const entries = results.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const result = item as Record<string, unknown>
    const title = typeof result.title === "string" ? result.title : typeof result.name === "string" ? result.name : "Search result"
    const url = typeof result.url === "string" ? result.url : ""
    const content = typeof result.content === "string" ? result.content : typeof result.snippet === "string" ? result.snippet : ""
    return [`${title}${url ? `\n${url}` : ""}${content ? `\n${content}` : ""}`]
  })
  return [answer, ...entries].filter(Boolean).join("\n\n") || "No search results found. Please try a different query."
}

function callRest(url: string, init: RequestInit) {
  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, init)
      if (!response.ok) throw new Error(`Web search request failed: ${response.status}`)
      return searchText(await response.json())
    },
    catch: (error) => error,
  })
}

function callProvider(
  http: HttpClient.HttpClient,
  provider: WebSearchProvider,
  params: Schema.Schema.Type<typeof Parameters>,
  ctx: Tool.Context,
  key?: string,
  endpoint?: string,
) {
  if (provider === "bing") {
    const url = new URL(endpoint || process.env.DEVECO_BING_SEARCH_ENDPOINT || "https://api.bing.microsoft.com/v7.0/search")
    url.searchParams.set("q", params.query)
    url.searchParams.set("count", String(params.numResults ?? 8))
    return callRest(url.toString(), { headers: key ? { "Ocp-Apim-Subscription-Key": key } : {} })
  }

  if (provider === "tavily") {
    return callRest("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: key, query: params.query, max_results: params.numResults ?? 8, search_depth: params.type === "deep" ? "advanced" : "basic" }),
    })
  }

  if (provider === "parallel") {
    return McpWebSearch.call(
      http,
      McpWebSearch.PARALLEL_URL,
      "web_search",
      McpWebSearch.ParallelSearchArgs,
      {
        objective: params.query,
        search_queries: [params.query],
        session_id: ctx.sessionID,
        model_name: webSearchModelName(ctx.extra),
      },
      "25 seconds",
      authHeaders(key ?? process.env.PARALLEL_API_KEY),
    )
  }

  return McpWebSearch.call(
    http,
    McpWebSearch.EXA_URL,
    "web_search_exa",
    McpWebSearch.SearchArgs,
    {
      query: params.query,
      type: params.type || "auto",
      numResults: params.numResults || 8,
      livecrawl: params.livecrawl || "fallback",
      contextMaxCharacters: params.contextMaxCharacters,
    },
    "25 seconds",
    authHeaders(key ?? process.env.EXA_API_KEY),
  )
}

export const WebSearchTool = Tool.define(
  "websearch",
  Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient
    const flags = yield* RuntimeFlags.Service
    const auth = yield* Auth.Service

    return {
      get description() {
        return DESCRIPTION.replace("{{year}}", new Date().getFullYear().toString())
      },
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const settings = yield* auth.get("deveco-websearch").pipe(Effect.orElseSucceed(() => undefined))
          const configured = settings?.type === "api" ? settings.metadata : undefined
          const provider = configured?.provider === "exa" || configured?.provider === "parallel" || configured?.provider === "bing" || configured?.provider === "tavily"
            ? configured.provider
            : selectWebSearchProvider(ctx.sessionID, {
            exa: flags.enableExa,
            parallel: flags.enableParallel,
          })
          if (configured?.enabled === "false") return yield* Effect.fail(new Error("Web search is disabled in Capability Center"))
          const credential = yield* auth.get(`deveco-websearch-${provider}`).pipe(Effect.orElseSucceed(() => undefined))
          const key = credential?.type === "api" ? credential.key : undefined
          const title = webSearchProviderLabel(provider)
          yield* ctx.metadata({ title: `${title} "${params.query}"`, metadata: { provider } })

          yield* ctx.ask({
            permission: "websearch",
            patterns: [params.query],
            always: ["*"],
            metadata: {
              query: params.query,
              numResults: params.numResults,
              livecrawl: params.livecrawl,
              type: params.type,
              contextMaxCharacters: params.contextMaxCharacters,
              provider,
            },
          })

          const result = yield* callProvider(http, provider, params, ctx, key, configured?.bing_endpoint)

          return {
            output: result ?? "No search results found. Please try a different query.",
            title: `${title}: ${params.query}`,
            metadata: { provider },
          }
        }).pipe(Effect.orDie),
    }
  }),
)
