import type { Todo, Message, Part, UserMessage } from "@opencode-ai/sdk/v2"
import { For, Show, createMemo, createSignal, createUniqueId, type JSX } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import { findLast } from "@opencode-ai/core/util/array"
import { useSync } from "@/context/sync"
import { useProviders } from "@/hooks/use-providers"
import { useSessionLayout } from "@/pages/session/session-layout"
import { useSDK } from "@/context/sdk"
import { getSessionContextMetrics } from "@/components/session/session-context-metrics"
import {
  estimateSessionContextBreakdown,
  type SessionContextBreakdownKey,
} from "@/components/session/session-context-breakdown"
import { buildSessionContextBudget } from "@/components/session/session-context-budget"
import { displayTodoOrder } from "./session-todo-order"

type Status = Todo["status"]

const BREAKDOWN_COLOR: Record<SessionContextBreakdownKey, string> = {
  system: "var(--syntax-info)",
  user: "var(--syntax-success)",
  assistant: "var(--syntax-property)",
  tool: "var(--syntax-warning)",
  other: "var(--syntax-comment)",
}

const BREAKDOWN_LABEL: Record<SessionContextBreakdownKey, string> = {
  system: "系统",
  user: "用户",
  assistant: "助手",
  tool: "工具",
  other: "其他",
}

function StatusIcon(props: { status: Status }) {
  if (props.status === "completed") {
    return (
      <div class="w-[18px] h-[18px] rounded-full bg-[var(--v2-state-bg-success)] border border-[var(--v2-state-border-success)] text-[var(--v2-state-fg-success)] flex items-center justify-center flex-shrink-0 mt-px">
        <svg
          viewBox="0 0 12 12"
          class="w-[9px] h-[9px]"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <polyline points="2 6 5 9 10 3" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
    )
  }
  if (props.status === "in_progress") {
    return (
      <div class="relative grid size-[18px] place-items-center flex-shrink-0 mt-px">
        <div class="absolute size-[18px] rounded-full border-2 border-[var(--v2-icon-icon-accent)] opacity-70" />
        <div
          class="summary-status-pulse relative size-[8px] rounded-full bg-[var(--v2-icon-icon-accent)]"
        />
      </div>
    )
  }
  if (props.status === "cancelled") {
    return (
      <div class="w-[18px] h-[18px] rounded-full border border-[var(--v2-border-border-muted)] text-[var(--v2-icon-icon-muted)] flex items-center justify-center flex-shrink-0 mt-px">
        <svg viewBox="0 0 12 12" class="w-[9px] h-[9px]" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="3" x2="9" y2="9" stroke-linecap="round" />
          <line x1="9" y1="3" x2="3" y2="9" stroke-linecap="round" />
        </svg>
      </div>
    )
  }
  return (
    <div class="w-[18px] h-[18px] rounded-full border-[1.5px] border-[var(--v2-border-border-strong)] flex-shrink-0 mt-px" />
  )
}

function Section(props: {
  title: string
  badge?: string
  action?: JSX.Element
  defaultOpen?: boolean
  children: JSX.Element
}) {
  const [open, setOpen] = createSignal(props.defaultOpen ?? true)
  const contentId = createUniqueId()
  return (
    <div class="rounded-lg border border-[var(--v2-border-border-muted)] bg-[var(--v2-background-bg-layer-01)]/60 backdrop-blur-[8px] shadow-[var(--v2-elevation-raised)] overflow-hidden">
      <div class="flex items-center gap-1.5 pl-1.5 pr-2 h-9">
        <button
          type="button"
          onClick={() => setOpen(!open())}
          aria-expanded={open()}
          aria-controls={contentId}
          class="flex items-center gap-1.5 flex-1 min-w-0 text-left group h-full rounded-md focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--v2-border-border-focus)]"
        >
          <Icon
            name={open() ? "chevron-down" : "chevron-right"}
            class="w-3.5 h-3.5 shrink-0 text-v2-icon-icon-muted group-hover:text-v2-icon-icon-base transition-colors"
          />
          <span class="text-[13px] font-[530] leading-5 text-v2-text-text-base truncate">
            {props.title}
          </span>
        </button>
        <Show when={props.badge}>
          <span class="text-[11px] font-mono tabular-nums leading-4 text-v2-text-text-faint shrink-0">
            {props.badge}
          </span>
        </Show>
        <Show when={props.action}>{props.action}</Show>
      </div>
      <Show when={open()}>
        <div id={contentId}>{props.children}</div>
      </Show>
    </div>
  )
}

function TodoSection(props: { todos: () => Todo[] }) {
  const done = createMemo(() => props.todos().filter((t) => t.status === "completed").length)
  const total = createMemo(() => props.todos().length)

  return (
    <Section title="待办" badge={total() > 0 ? `${done()}/${total()}` : undefined}>
      <Show
        when={props.todos().length > 0}
        fallback={
          <div class="mx-2.5 mb-2.5 px-3 py-3.5 rounded-lg border border-dashed border-[var(--v2-border-border-muted)] text-[12px] leading-4 text-v2-text-text-faint text-center">
            AI 拆分任务时会显示在这里
          </div>
        }
      >
        <ul class="flex flex-col gap-px px-2 pb-2">
          <For each={displayTodoOrder(props.todos())}>
            {(todo) => {
              const isDone = todo.status === "completed"
              const cancelled = todo.status === "cancelled"
              const active = todo.status === "in_progress"
              return (
                <li
                  classList={{
                    "group relative flex items-start gap-2.5 pl-2.5 pr-2 py-[7px] rounded-lg transition-colors": true,
                    "bg-[var(--v2-overlay-simple-overlay-hover)]": active,
                    "hover:bg-[var(--v2-overlay-simple-overlay-hover)]": !active,
                  }}
                >
                  <Show when={active}>
                    <div class="absolute left-0 top-[7px] bottom-[7px] w-[2px] rounded-full bg-[var(--v2-icon-icon-accent)]" />
                  </Show>
                  <div class="pt-[1px]">
                    <StatusIcon status={todo.status} />
                  </div>
                  <span
                    classList={{
                      "text-[13px] font-[440] leading-[1.45] flex-1 min-w-0 break-words": true,
                      "text-v2-text-text-base": !isDone && !cancelled,
                      "text-v2-text-text-faint line-through decoration-[var(--v2-border-border-strong)] decoration-[1.5px]":
                        isDone,
                      "text-v2-text-text-faint": cancelled,
                      "text-[var(--v2-text-text-accent)]": active,
                    }}
                  >
                    {todo.content}
                  </span>
                </li>
              )
            }}
          </For>
        </ul>
      </Show>
    </Section>
  )
}

function ContextSection() {
  const sync = useSync()
  const providers = useProviders()
  const sdk = useSDK()
  const { params } = useSessionLayout()
  const [summarizing, setSummarizing] = createSignal(false)
  const [summaryError, setSummaryError] = createSignal("")
  const [detailsOpen, setDetailsOpen] = createSignal(false)

  const info = createMemo(() => (params.id ? sync().session.get(params.id) : undefined))
  const messages = createMemo<Message[]>(() => {
    const id = params.id
    if (!id) return []
    return (sync().data.message[id] ?? []) as Message[]
  })

  const userMessages = createMemo(
    () => messages().filter((m) => m.role === "user") as UserMessage[],
  )

  const visibleUserMessages = createMemo(() => {
    const revert = info()?.revert?.messageID
    if (!revert) return userMessages()
    return userMessages().filter((m) => m.id < revert)
  })

  const systemPrompt = createMemo(() => {
    const msg = findLast(visibleUserMessages(), (m) => !!m.system)
    return msg?.system?.trim() || undefined
  })

  const metrics = createMemo(() =>
    getSessionContextMetrics(messages(), [...providers.all().values()]),
  )
  const ctx = createMemo(() => metrics().context)

  const breakdown = createMemo(() => {
    const c = ctx()
    if (!c?.input) return []
    return estimateSessionContextBreakdown({
      messages: messages(),
      parts: sync().data.part as Record<string, Part[] | undefined>,
      input: c.input,
      systemPrompt: systemPrompt(),
    })
  })

  const budget = createMemo(() => {
    const c = ctx()
    return buildSessionContextBudget({
      total: c?.input ?? 0,
      limit: c?.limit,
      breakdown: breakdown(),
    })
  })

  const percentLabel = createMemo(() => {
    const usage = budget().usage
    if (usage === null) return "--"
    if (usage === 0 && (ctx()?.input ?? 0) > 0) return "<1"
    return String(usage)
  })

  const visibleSegments = createMemo(() => (detailsOpen() ? budget().segments : budget().segments.slice(0, 3)))

  const hasData = createMemo(() => !!ctx() && (ctx()?.input ?? 0) > 0)

  const summarize = async () => {
    const id = params.id
    const c = ctx()
    if (!id || !c || summarizing()) return
    setSummarizing(true)
    setSummaryError("")
    try {
      await sdk().client.session.summarize({
        sessionID: id,
        modelID: c.message.modelID,
        providerID: c.message.providerID,
      })
    } catch (error) {
      console.error("summarize failed", error)
      setSummaryError(error instanceof Error ? error.message : "上下文压缩失败，请稍后重试")
    } finally {
      setSummarizing(false)
    }
  }

  return (
    <Section
      title="上下文"
      badge={hasData() ? `${percentLabel()}%` : undefined}
      action={
        <Show when={hasData()}>
          <button
            type="button"
            onClick={() => void summarize()}
            title="压缩较早的会话内容以释放上下文"
            aria-label={summarizing() ? "正在压缩上下文" : "压缩较早的会话内容以释放上下文"}
            aria-busy={summarizing()}
            disabled={summarizing()}
            class="h-7 px-2.5 shrink-0 rounded-md text-[11px] font-[500] leading-4 text-[var(--v2-text-text-accent)] border border-[var(--v2-border-border-base)] transition-colors hover:bg-[var(--v2-overlay-simple-overlay-hover)] active:bg-[var(--v2-overlay-simple-overlay-pressed)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--v2-border-border-focus)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {summarizing() ? "压缩中" : "压缩"}
          </button>
        </Show>
      }
    >
      <Show
        when={hasData()}
        fallback={
          <div class="mx-2.5 mb-2.5 px-3 py-3.5 rounded-lg border border-dashed border-[var(--v2-border-border-muted)] text-[12px] leading-4 text-v2-text-text-faint text-center">
            AI 开始工作后会显示上下文占用
          </div>
        }
      >
        <div class="flex flex-col gap-3 px-2.5 pb-2.5">
          <Show when={summaryError()}>
            <div
              class="px-2.5 py-2 rounded-md border border-[var(--v2-state-border-danger)] bg-[var(--v2-state-bg-danger)] text-[11px] leading-4 text-[var(--v2-state-fg-danger)]"
              role="alert"
            >
              {summaryError()}
            </div>
          </Show>
          <div class="flex flex-col gap-2.5" aria-label={`上下文已使用 ${percentLabel()}%`}>
            <div class="flex items-baseline justify-between gap-2">
              <div class="flex items-baseline gap-1 min-w-0">
                <span class="text-[15px] font-[600] leading-5 text-v2-text-text-base font-mono tabular-nums">
                  {formatTokens(ctx()!.input)}
                </span>
                <Show when={ctx()?.limit}>
                  <span class="text-[11px] font-mono tabular-nums text-v2-text-text-faint">
                    / {formatTokens(ctx()!.limit!)}
                  </span>
                </Show>
                <span class="text-[11px] text-v2-text-text-faint">Token</span>
              </div>
              <span
                classList={{
                  "text-[12px] font-mono tabular-nums shrink-0": true,
                  "text-[var(--v2-state-fg-danger)]": budget().status === "critical",
                  "text-[var(--v2-state-fg-warning)]": budget().status === "warning",
                  "text-v2-text-text-accent": budget().status === "healthy",
                  "text-v2-text-text-faint": budget().status === "unavailable",
                }}
              >
                {percentLabel()}%
              </span>
            </div>

            <div class="flex items-center justify-between gap-2 text-[11px] leading-4 text-v2-text-text-faint">
              <span>本轮消耗</span>
              <span class="font-mono tabular-nums">{formatTokens(ctx()!.total)} Token</span>
            </div>

            <Show when={budget().usage !== null}>
              <div class="h-1.5 rounded-full bg-[var(--v2-overlay-simple-overlay-hover)] overflow-hidden" role="img" aria-label={`上下文预算已使用 ${percentLabel()}%`}>
                <div
                  class="h-full rounded-full transition-[width] duration-300 bg-[var(--v2-icon-icon-accent)]"
                  style={{ width: `${budget().usage}%` }}
                />
              </div>
            </Show>

            <Show when={budget().segments.length > 0}>
              <div class="flex flex-col gap-2 pt-0.5">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[11px] leading-4 text-v2-text-text-faint">上下文来源</span>
                  <span class="text-[11px] leading-4 text-v2-text-text-faint truncate">{ctx()!.modelLabel}</span>
                </div>
                <div class="h-2 rounded-full bg-[var(--v2-overlay-simple-overlay-hover)] overflow-hidden flex" role="img" aria-label="上下文来源组成">
                  <For each={budget().segments}>
                    {(segment) => (
                      <div
                        class="h-full transition-[width] duration-300"
                    style={{ width: `${segment.budgetPercent}%`, background: BREAKDOWN_COLOR[segment.key] }}
                      />
                    )}
                  </For>
                </div>
                <div class="flex flex-col divide-y divide-[var(--v2-border-border-muted)] border-y border-[var(--v2-border-border-muted)]">
                  <For each={visibleSegments()}>
                    {(segment) => (
                      <div class="flex items-center gap-2 py-1.5 min-w-0">
                        <div class="size-1.5 rounded-full shrink-0" style={{ background: BREAKDOWN_COLOR[segment.key] }} />
                        <span class="text-[11px] leading-4 text-v2-text-text-base truncate">{BREAKDOWN_LABEL[segment.key]}</span>
                        <span class="ml-auto text-[11px] font-mono tabular-nums leading-4 text-v2-text-text-faint shrink-0">
                          {formatTokens(segment.tokens)}
                        </span>
                        <span class="w-8 text-right text-[11px] font-mono tabular-nums leading-4 text-v2-text-text-faint shrink-0">
                          {segment.percent < 1 ? "<1" : Math.round(segment.percent)}%
                        </span>
                      </div>
                    )}
                  </For>
                </div>
                <Show when={budget().segments.length > 3}>
                  <button
                    type="button"
                    class="self-start text-[11px] leading-4 text-v2-text-text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--v2-border-border-focus)]"
                    onClick={() => setDetailsOpen(!detailsOpen())}
                    aria-expanded={detailsOpen()}
                    aria-label={detailsOpen() ? "收起上下文来源明细" : "查看上下文来源明细"}
                  >
                    {detailsOpen() ? "收起明细" : `查看全部 ${budget().segments.length} 项`}
                  </button>
                </Show>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </Section>
  )
}

function formatTokens(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K"
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
}

export function SessionSummaryTab(props: { todos?: () => Todo[] }) {
  return (
    <div class="flex flex-col gap-2.5 p-2.5 h-full overflow-y-auto">
      <Show when={props.todos}>
        <TodoSection todos={props.todos!} />
      </Show>
      <ContextSection />
    </div>
  )
}
