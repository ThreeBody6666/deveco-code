import { describe, expect, test } from "bun:test"
import { buildSessionContextBudget } from "./session-context-budget"

describe("buildSessionContextBudget", () => {
  test("orders context sources by token use and scales them to the context budget", () => {
    const budget = buildSessionContextBudget({
      total: 8_100,
      limit: 10_000,
      breakdown: [
        { key: "user", tokens: 1_600, width: 20, percent: 20 },
        { key: "tool", tokens: 6_400, width: 80, percent: 80 },
      ],
    })

    expect(budget.usage).toBe(81)
    expect(budget.status).toBe("warning")
    expect(budget.segments.map((item) => item.key)).toEqual(["tool", "user"])
    expect(budget.segments.map((item) => item.budgetPercent)).toEqual([64.8, 16.2])
  })

  test("does not fabricate a zero percent budget when the model limit is unknown", () => {
    expect(
      buildSessionContextBudget({
        total: 2_000,
        limit: undefined,
        breakdown: [{ key: "tool", tokens: 2_000, width: 100, percent: 100 }],
      }),
    ).toMatchObject({
      usage: null,
      status: "unavailable",
      segments: [{ key: "tool", budgetPercent: 0 }],
    })
  })
})
