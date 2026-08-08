# 会话上下文预算面板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将会话右侧的上下文摘要改为参考 Trae Work 的预算面板，清晰展示总用量、来源分布和高占用来源明细。

**Architecture:** 继续以 `getSessionContextMetrics()` 取得模型上下文总量和上限，以 `estimateSessionContextBreakdown()` 取得输入 Token 的来源估算。新增一个纯数据适配器，将原始分布标准化为适合紧凑面板的预算行；`SessionSummaryTab` 只负责渲染、展开和调用既有压缩接口。

**Tech Stack:** SolidJS、TypeScript、Tailwind utility classes、Bun 测试、现有 OpenCode SDK。

## Global Constraints

- 不改变服务端上下文、模型请求和 `session.summarize` 的压缩语义。
- 使用现有主题变量和当前右侧摘要面板的折叠交互。
- 预算条必须有文本等价描述；颜色不能作为唯一信息来源。
- 窄侧栏默认显示预算与分类指标，详细列表按需展开。

---

### Task 1: 预算数据适配器

**Files:**
- Create: `packages/app/src/components/session/session-context-budget.ts`
- Create: `packages/app/src/components/session/session-context-budget.test.ts`

**Interfaces:**
- Consumes: `SessionContextBreakdown` 项目中的 `key`、`percent` 和 `tokens` 字段。
- Produces: `buildSessionContextBudget({ total, limit, breakdown })`，返回 `{ usage, status, segments, summary }`。

- [ ] **Step 1: 写出失败的测试**

```ts
test("orders budget segments by token use and keeps their labels", () => {
  const budget = buildSessionContextBudget({
    total: 8_100,
    limit: 10_000,
    breakdown: [
      { key: "user", tokens: 1_600, percent: 20 },
      { key: "tool", tokens: 6_400, percent: 80 },
    ],
  })

  expect(budget.usage).toBe(81)
  expect(budget.segments.map((item) => item.key)).toEqual(["tool", "user"])
  expect(budget.segments[0].tokens).toBe(6_400)
})

test("uses an unavailable state without a fake zero-percent bar", () => {
  expect(buildSessionContextBudget({ total: 0, limit: undefined, breakdown: [] })).toMatchObject({
    usage: null,
    status: "unavailable",
    segments: [],
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `bun test src/components/session/session-context-budget.test.ts`

Expected: FAIL，因为 `session-context-budget.ts` 和 `buildSessionContextBudget` 尚不存在。

- [ ] **Step 3: 实现最小适配器**

```ts
export function buildSessionContextBudget(input: {
  total: number
  limit: number | undefined
  breakdown: readonly { key: SessionContextBreakdownKey; tokens: number; percent: number }[]
}) {
  const usage = input.limit ? Math.min(100, Math.round((input.total / input.limit) * 100)) : null
  return {
    usage,
    status: usage === null ? "unavailable" : usage >= 90 ? "critical" : usage >= 70 ? "warning" : "healthy",
    segments: input.breakdown.filter((item) => item.tokens > 0).toSorted((a, b) => b.tokens - a.tokens),
    summary: input.limit ? `${input.total} / ${input.limit}` : `${input.total}`,
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `bun test src/components/session/session-context-budget.test.ts`

Expected: PASS，两个测试均通过。

### Task 2: 上下文预算面板

**Files:**
- Modify: `packages/app/src/pages/session/session-summary-tab.tsx:135-254`
- Modify: `packages/app/src/pages/session/session-summary-tab.tsx:1-12`
- Create: `packages/app/src/pages/session/session-summary-tab.test.tsx`

**Interfaces:**
- Consumes: `buildSessionContextBudget()`、现有 `ctx()`、`breakdown()`、`summarize()` 和 `formatTokens()`。
- Produces: 可展开的预算视图，包含总 Token、状态、分段预算条、分类指标行和最多三项的高占用来源明细。

- [ ] **Step 1: 写出失败的渲染测试**

```tsx
test("shows context budget source rows with tokens and percentages", async () => {
  render(() => <ContextBudgetPanel budget={budgetFixture} />)

  expect(screen.getByText("工具")).toBeInTheDocument()
  expect(screen.getByText("6.4K")).toBeInTheDocument()
  expect(screen.getByText("80%")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "查看上下文来源明细" })).toBeInTheDocument()
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `bun test src/pages/session/session-summary-tab.test.tsx`

Expected: FAIL，因为 `ContextBudgetPanel` 与相应无障碍标签尚不存在。

- [ ] **Step 3: 实现紧凑面板**

```tsx
<div aria-label={budget().summary} class="flex flex-col gap-2.5">
  <div class="flex items-baseline justify-between">
    <span class="font-mono tabular-nums">{formatTokens(ctx()!.total)} / {formatTokens(ctx()!.limit!)}</span>
    <span>{percentLabel()}%</span>
  </div>
  <div class="h-2 overflow-hidden rounded-full" role="img" aria-label={budget().summary}>
    <For each={budget().segments}>{(segment) => <div style={{ width: `${segment.percent}%` }} />}</For>
  </div>
  <For each={budget().segments}>{(segment) => <ContextBudgetRow segment={segment} />}</For>
</div>
```

其中每个 `ContextBudgetRow` 显示色标、来源名称、Token 和百分比；超过三项时通过“查看上下文来源明细”按钮展开完整排序列表。来源明细使用现有估算数据，不宣称单条消息具有精确 Token 计量。压缩按钮保留在区块标题栏，追加 `title` 与 `aria-label` 说明它将压缩旧会话内容。

- [ ] **Step 4: 运行测试确认通过**

Run: `bun test src/pages/session/session-summary-tab.test.tsx`

Expected: PASS，来源、Token、百分比和展开控制均可访问。

### Task 3: 集成回归与视觉检查

**Files:**
- Modify: `packages/app/src/components/session/session-context-metrics.test.ts`（仅在适配器需要新增上下文边界场景时）

- [ ] **Step 1: 运行所有上下文相关测试**

Run: `bun test src/components/session/session-context-metrics.test.ts src/components/session/session-context-budget.test.ts src/pages/session/session-summary-tab.test.tsx`

Expected: PASS，零 Token、未知上下文上限、高工具占用和展开明细均受覆盖。

- [ ] **Step 2: 执行应用类型检查**

Run: `bun run typecheck`

Expected: exit code 0。

- [ ] **Step 3: 进行浏览器视觉检查**

Run: 使用现有本地应用或开发预览，在宽侧栏和窄侧栏分别确认：总用量、预算条、四类指标、明细展开、压缩按钮和空状态均不重叠且可读。

- [ ] **Step 4: 运行差异检查**

Run: `git diff --check`

Expected: exit code 0。
