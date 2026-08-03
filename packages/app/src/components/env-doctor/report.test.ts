import { describe, expect, test } from "bun:test"

import { toRows, isFirstRunPending, EnvDoctorRow } from "./report"

const okReport = {
  items: [
    { id: "deveco-code" as const, status: "ok" as const, version: "1.17.9" },
    { id: "deveco-studio" as const, status: "ok" as const, version: "6.0.1", path: "C:\\Program Files\\Huawei\\DevEco Studio" },
    { id: "deveco-cli" as const, status: "ok" as const, version: "1.2.3" },
    { id: "node" as const, status: "ok" as const, version: "22.5.0" },
  ],
  summary: { healthy: true, missing: [] },
  generatedAt: "2026-01-01T00:00:00.000Z",
}

describe("env doctor report helpers", () => {
  test("toRows keeps stable ordering: code, studio, cli, node", () => {
    const rows = toRows(okReport)
    expect(rows.map((r: EnvDoctorRow) => r.id)).toEqual([
      "deveco-code",
      "deveco-studio",
      "deveco-cli",
      "node",
    ])
  })

  test("toRows exposes a friendly label and status for each row", () => {
    const rows = toRows(okReport)
    const studio = rows.find((r: EnvDoctorRow) => r.id === "deveco-studio")!
    expect(studio.label).toBe("DevEco Studio")
    expect(studio.status).toBe("ok")
    expect(studio.actionLabel).toBe("已安装")
  })

  test("toRows action label switches to install for missing components", () => {
    const rows = toRows({
      ...okReport,
      items: okReport.items.map((i) => (i.id === "deveco-cli" ? { ...i, status: "missing" as const, version: undefined } : i)),
      summary: { healthy: false, missing: [{ id: "deveco-cli", status: "missing" }] },
    })
    const cli = rows.find((r: EnvDoctorRow) => r.id === "deveco-cli")!
    expect(cli.status).toBe("missing")
    expect(cli.actionLabel).toBe("一键安装")
  })

  test("isFirstRunPending returns true only when the store value is unset", () => {
    expect(isFirstRunPending(null)).toBe(true)
    expect(isFirstRunPending(undefined)).toBe(true)
    expect(isFirstRunPending("")).toBe(true)
    expect(isFirstRunPending("shown")).toBe(false)
  })
})
