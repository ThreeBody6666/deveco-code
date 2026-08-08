import type { SessionContextBreakdownSegment } from "./session-context-breakdown"

export type SessionContextBudgetStatus = "healthy" | "warning" | "critical" | "unavailable"

export type SessionContextBudget = {
  usage: number | null
  status: SessionContextBudgetStatus
  segments: (SessionContextBreakdownSegment & { budgetPercent: number })[]
}

export function buildSessionContextBudget(input: {
  total: number
  limit: number | undefined
  breakdown: readonly SessionContextBreakdownSegment[]
}): SessionContextBudget {
  const usage = input.limit ? Math.min(100, Math.round((input.total / input.limit) * 100)) : null
  const status: SessionContextBudgetStatus =
    usage === null ? "unavailable" : usage >= 90 ? "critical" : usage >= 70 ? "warning" : "healthy"
  const budgetScale = usage === null ? 0 : usage / 100

  return {
    usage,
    status,
    segments: input.breakdown
      .filter((item) => item.tokens > 0)
      .map((item) => ({ ...item, budgetPercent: Number((item.percent * budgetScale).toFixed(1)) }))
      .sort((a, b) => b.tokens - a.tokens),
  }
}
