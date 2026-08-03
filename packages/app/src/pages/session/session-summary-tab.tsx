import type { Todo, Message, Part, UserMessage } from "@opencode-ai/sdk/v2"
import { For, Show, createMemo, createSignal } from "solid-js"
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

type Status = Todo["status"]

const STATUS_ORDER: Record<Status, number> = {
  in_progress: 0,
  pending: 1,
  completed: 2,
  cancelled: 3,
}

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
      <div class="relative w-[18px] h-[18px] flex-shrink-0 mt-px">
        <div class="absolute inset-0 rounded-full border-2 border-[var(--v2-icon-icon-accent)] opacity-70" />
        <div
          class="absolute inset-[3px] rounded-full bg-[var(--v2-icon-icon-accent)]"
          style={{ animation: "summary-status-pulse 1.4s ease-in-out infinite" }}
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
  action?: any
  defaultOpen?: boolean
  children: any
}) {
  const [open, setOpen] = createSignal(props.defaultOpen ?? true)
  return (
    <div class="rounded-[10px] border border-[var(--v2-border-border-muted)] bg-[var(--v2-background-bg-layer-01)]/60 backdrop-blur-[8px] shadow-[var(--v2-elevation-raised)] overflow-hidden">
      <div class="flex items-center gap-1.5 pl-1.5 pr-2 h-9">
        <button
          type="button"
          onClick={() => setOpen(!open())}
          class="flex items-center gap-1.5 flex-1 min-w-0 text-left group h-full"
        >
          <Icon
            name={open() ? "chevron-down" : "chevron-right"}
            class="w-3.5 h-3.5 shrink-0 text-v2-icon-icon-muted group-hover:text-v2-icon-icon-base transition-colors"
          />
          <span class="text-[13px] font-[530] leading-5 tracking-[-0.01px] text-v2-text-text-base truncate">
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
      <Show when={open()}>{props.children}</Show>
    </div>
  )
}

function TodoSection(props: { todos: () => Todo[] }) {
  const sorted = createMemo(() =>
    [...props.todos()].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]),
  )
  const done = createMemo(() => props.todos().filter((t) => t.status === "completed").length)
  const total = createMemo(() => props.todos().length)

  return (
    <Section title="待办" badge={total() > 0 ? `${done()}/${total()}` : undefined}>
      <Show
        when={sorted().length > 0}
        fallback={
          <div class="mx-2.5 mb-2.5 px-3 py-3.5 rounded-lg border border-dashed border-[var(--v2-border-border-muted)] text-[12px] leading-4 text-v2-text-text-faint text-center">
            AI 拆分任务时会显示在这里
          </div>
        }
      >
        <ul class="flex flex-col gap-px px-2 pb-2">
          <For each={sorted()}>
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
                      "text-[13px] font-[440] leading-[1.45] tracking-[-0.01px] flex-1 min-w-0 break-words": true,
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

  const percent = createMemo(() => {
    const c = ctx()
    if (!c || !c.limit) return 0
    return Math.min(100, Math.max(0, (c.total / c.limit) * 100))
  })
  const percentLabel = createMemo(() => {
    const p = percent()
    if (p === 0) return "0"
    if (p < 1) return "<1"
    return String(Math.round(p))
  })

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

  const hasData = createMemo(() => !!ctx() && (ctx()?.total ?? 0) > 0)

  const summarize = async () => {
    const id = params.id
    const c = ctx()
    if (!id || !c) return
    try {
      await sdk().client.session.summarize({
        sessionID: id,
        modelID: c.message.modelID,
        providerID: c.message.providerID,
      })
    } catch (e) {
      console.error("summarize failed", e)
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
            onClick={summarize}
            title="压缩上下文"
            class="h-6 px-2 shrink-0 rounded-md text-[11px] font-[500] leading-4 text-[var(--v2-text-text-accent)] border border-[var(--v2-border-border-base)] transition-colors hover:bg-[var(--v2-overlay-simple-overlay-hover)]"
          >
            压缩
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
          {/* 进度条 */}
          <div class="flex flex-col gap-1.5">
            <div class="h-1.5 rounded-full bg-[var(--v2-overlay-simple-overlay-hover)] overflow-hidden flex">
              <Show
                when={breakdown().length > 0}
                fallback={
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${percent()}%`,
                      background: "var(--v2-icon-icon-accent)",
                    }}
                  />
                }
              >
                <For each={breakdown()}>
                  {(seg) => (
                    <div
                      class="h-full transition-all duration-500"
                      style={{
                        width: `${(seg.percent * percent()) / 100}%`,
                        background: BREAKDOWN_COLOR[seg.key],
                      }}
                    />
                  )}
                </For>
              </Show>
            </div>
            <Show when={ctx()?.limit}>
              <div class="flex items-center justify-between gap-2">
                <span class="text-[11px] font-mono tabular-nums leading-4 text-v2-text-text-faint">
                  {formatTokens(ctx()!.total)} / {formatTokens(ctx()!.limit!)}
                </span>
                <span class="text-[11px] leading-4 text-v2-text-text-faint truncate">
                  {ctx()!.modelLabel}
                </span>
              </div>
            </Show>
          </div>

          {/* 图例 */}
          <Show when={breakdown().length > 0}>
            <div class="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <For each={breakdown()}>
                {(seg) => (
                  <div class="flex items-center gap-1.5 min-w-0">
                    <div
                      class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: BREAKDOWN_COLOR[seg.key] }}
                    />
                    <span class="text-[11px] leading-4 text-v2-text-text-faint truncate">
                      {BREAKDOWN_LABEL[seg.key]}
                    </span>
                    <span class="text-[11px] font-mono tabular-nums leading-4 text-v2-text-text-faint ml-auto">
                      {seg.percent < 1 ? "<1" : Math.round(seg.percent)}%
                    </span>
                  </div>
                )}
              </For>
            </div>
          </Show>
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
