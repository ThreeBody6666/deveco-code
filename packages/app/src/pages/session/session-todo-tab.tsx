import type { Todo } from "@opencode-ai/sdk/v2"
import { For, Show, createMemo } from "solid-js"
import { Checkbox } from "@opencode-ai/ui/checkbox"
import { useLanguage } from "@/context/language"

type Status = Todo["status"]

const STATUS_ORDER: Record<Status, number> = {
  in_progress: 0,
  pending: 1,
  completed: 2,
  cancelled: 3,
}

const STATUS_LABEL: Record<Status, string> = {
  in_progress: "进行中",
  pending: "待办",
  completed: "已完成",
  cancelled: "已取消",
}

const STATUS_COLOR: Record<Status, string> = {
  in_progress: "text-blue-500",
  pending: "text-gray-500",
  completed: "text-emerald-500",
  cancelled: "text-gray-400",
}

export function SessionTodoTab(props: { todos: () => Todo[] }) {
  const language = useLanguage()

  const total = createMemo(() => props.todos().length)
  const done = createMemo(() => props.todos().filter((t) => t.status === "completed").length)
  const inProgress = createMemo(() => props.todos().filter((t) => t.status === "in_progress").length)
  const percent = createMemo(() => (total() === 0 ? 0 : Math.round((done() / total()) * 100)))

  const sorted = createMemo(() =>
    [...props.todos()].sort((a, b) => {
      const diff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      if (diff !== 0) return diff
      return 0
    }),
  )

  return (
    <div class="flex flex-col h-full overflow-hidden">
      {/* Header - 进度概览 */}
      <div class="flex flex-col gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-gray-900 dark:text-gray-100">
            {language.t("session.todo.progress", { done: done(), total: total() })}
          </span>
          <Show when={total() > 0}>
            <span class="text-xs text-gray-500 dark:text-gray-400 font-mono">
              {percent()}%
            </span>
          </Show>
        </div>
        <Show when={total() > 0}>
          <div class="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              class="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${percent()}%` }}
            />
          </div>
          <Show when={inProgress() > 0}>
            <span class="text-xs text-blue-500">正在进行 {inProgress()} 项</span>
          </Show>
        </Show>
      </div>

      {/* Todo list */}
      <div class="flex-1 overflow-y-auto">
        <Show
          when={total() > 0}
          fallback={
            <div class="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
              <span class="text-sm text-gray-500 dark:text-gray-400">
                暂无待办
              </span>
              <span class="text-xs text-gray-400 dark:text-gray-500">
                当 AI 拆分任务时，待办列表会自动显示在这里
              </span>
            </div>
          }
        >
          <ul class="flex flex-col divide-y divide-gray-50 dark:divide-gray-900">
            <For each={sorted()}>
              {(todo) => {
                const done = todo.status === "completed"
                const cancelled = todo.status === "cancelled"
                const active = todo.status === "in_progress"
                return (
                  <li class="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors">
                    <div class="flex-shrink-0 pt-0.5">
                      <Checkbox checked={done} disabled />
                    </div>
                    <div class="flex flex-col gap-1 min-w-0 flex-1">
                      <span
                        classList={{
                          "text-sm leading-relaxed": true,
                          "text-gray-900 dark:text-gray-100": !done && !cancelled,
                          "text-gray-400 line-through": done,
                          "text-gray-400": cancelled,
                          "font-medium": active,
                        }}
                      >
                        {todo.content}
                      </span>
                      <div class="flex items-center gap-2">
                        <span class={`text-[11px] uppercase tracking-wide ${STATUS_COLOR[todo.status]}`}>
                          {STATUS_LABEL[todo.status]}
                        </span>
                        <Show when={todo.priority === "high"}>
                          <span class="text-[11px] text-red-500 uppercase tracking-wide">
                            高优先级
                          </span>
                        </Show>
                      </div>
                    </div>
                  </li>
                )
              }}
            </For>
          </ul>
        </Show>
      </div>
    </div>
  )
}
