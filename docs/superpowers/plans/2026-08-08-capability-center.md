# 能力中心 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 DevEco Code 设置中提供可视化技能管理与联网搜索配置，并复用现有 Skill、MCP 和 WebSearch 工具。

**Architecture:** 后端增加用户级能力中心配置和 HTTP API，管理由应用安装的技能目录、可用状态和 WebSearch 服务配置。桌面端将 API 数据渲染为能力中心设置页；技能执行仍由既有 `Skill.Service` 加载，搜索执行仍由既有 `websearch` 工具完成。

**Tech Stack:** Effect HTTP API、TypeScript、SolidJS、Desktop secure storage、Bun tests、现有 MCP/Skill/WebSearch 服务。

## Global Constraints

- 不修改现有 Skill 解析、模型请求或压缩逻辑。
- API Key 不写入项目配置、会话消息或日志；界面仅显示脱敏状态。
- 仅允许能力中心安装目录中的技能被卸载。
- 卸载、覆盖版本和启用联网 MCP 服务必须经过用户确认。
- 新配置只在新会话中生效，当前会话保持已有工具权限。

---

### Task 1: 能力中心配置与技能目录服务

**Files:**
- Create: `packages/opencode/src/capability/config.ts`
- Create: `packages/opencode/src/capability/skill-manager.ts`
- Create: `packages/opencode/src/capability/skill-manager.test.ts`
- Modify: `packages/opencode/src/skill/index.ts`

**Interfaces:**
- Produces `CapabilityConfig` with `{ skills: Record<string, { enabled: boolean; source: "skillhub" | "local"; installedAt: number }>; websearch: { enabled: boolean; provider?: "exa" | "parallel" } }`.
- Produces `SkillManager.list()`, `installLocal(path)`, `setEnabled(name, enabled)`, and `uninstall(name)`.
- `SkillManager.uninstall()` only permits a resolved path beneath the managed skills root.

- [ ] **Step 1: 写出失败的技能删除边界测试**

```ts
test("removes only skills installed in the managed root", async () => {
  const manager = SkillManager.make({ root: "C:/state/capabilities/skills" })
  await expect(manager.uninstall("external-skill", "C:/Users/me/.agents/skills/external/SKILL.md")).rejects.toThrow(
    "managed skills root",
  )
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `bun test src/capability/skill-manager.test.ts`

Expected: FAIL，因为 `SkillManager` 尚不存在。

- [ ] **Step 3: 实现配置与受限文件操作**

```ts
const insideManagedRoot = (root: string, target: string) => {
  const relative = path.relative(root, target)
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
}

export async function uninstall(name: string, location: string) {
  if (!insideManagedRoot(root, location)) throw new Error("Skill is outside the managed skills root")
  await fs.rm(path.dirname(location), { recursive: true })
  await config.removeSkill(name)
}
```

- [ ] **Step 4: 将已启用的受管技能加入现有 Skill 服务扫描目录**

Run: `bun test src/capability/skill-manager.test.ts`

Expected: PASS，受管目录技能可列出，外部路径无法删除。

### Task 2: 搜索服务安全配置与诊断

**Files:**
- Create: `packages/opencode/src/capability/websearch-manager.ts`
- Create: `packages/opencode/src/capability/websearch-manager.test.ts`
- Modify: `packages/core/src/tool/websearch.ts`
- Modify: `packages/opencode/src/tool/websearch.ts`

**Interfaces:**
- Produces `WebSearchManager.getStatus()`，返回 `{ enabled, provider, exa: { configured, reachable }, parallel: { configured, reachable } }`，不返回密钥。
- Produces `WebSearchManager.setKey(provider, key)`、`setEnabled(enabled)`、`setProvider(provider)` 和 `test(provider)`。
- `WebSearchTool.ConfigService` 从能力中心配置读取启用状态、首选服务和密钥。

- [ ] **Step 1: 写出失败的搜索服务选择测试**

```ts
test("does not expose keys and disables search when capability is off", async () => {
  const manager = createWebSearchManager({ secretStore: fakeSecretStore({ exa: "secret" }) })
  await manager.setEnabled(false)
  expect(await manager.getStatus()).toMatchObject({ enabled: false, exa: { configured: true } })
  expect(JSON.stringify(await manager.getStatus())).not.toContain("secret")
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `bun test src/capability/websearch-manager.test.ts`

Expected: FAIL，因为 `WebSearchManager` 尚不存在。

- [ ] **Step 3: 实现安全配置和连接测试**

```ts
async function getStatus() {
  return {
    enabled: config.websearch.enabled,
    provider: config.websearch.provider,
    exa: { configured: await secrets.has("websearch:exa"), reachable: await probe("exa") },
    parallel: { configured: await secrets.has("websearch:parallel"), reachable: await probe("parallel") },
  }
}
```

- [ ] **Step 4: 让 WebSearch 工具尊重能力中心开关**

Run: `bun test src/capability/websearch-manager.test.ts`

Expected: PASS，密钥不出现在状态中，禁用时搜索工具不可调用。

### Task 3: 能力中心 HTTP API 与 SDK

**Files:**
- Modify: `packages/opencode/src/server/routes/instance/httpapi/api.ts`
- Modify: `packages/opencode/src/server/routes/instance/httpapi/handlers/instance.ts`
- Modify: `packages/sdk/js/src/v2/gen/types.gen.ts`
- Modify: `packages/sdk/js/src/v2/gen/sdk.gen.ts`
- Test: `packages/opencode/test/capability/httpapi.test.ts`

**Interfaces:**
- `GET /capability/skills` 仅返回技能元数据和是否受管。
- `POST /capability/skills/local` 导入本地技能；`PATCH /capability/skills/{name}` 切换启用状态；`DELETE /capability/skills/{name}` 删除受管技能。
- `GET /capability/websearch` 返回脱敏状态；`PATCH /capability/websearch` 更新开关或首选服务；`PUT /capability/websearch/{provider}/key` 写入密钥；`POST /capability/websearch/{provider}/test` 执行连接测试。

- [ ] **Step 1: 写出失败的 API 安全响应测试**

```ts
test("lists skills and returns web search status without API keys", async () => {
  const response = await api.get("/capability/websearch")
  expect(response.status).toBe(200)
  expect(response.body.exa.configured).toBe(true)
  expect(JSON.stringify(response.body)).not.toContain("exa-secret")
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `bun test test/capability/httpapi.test.ts`

Expected: FAIL，因为 capability 路由尚未注册。

- [ ] **Step 3: 注册 schema、handler 和 SDK 方法**

```ts
handlers.handle("capabilityWebSearch", () => manager.getStatus())
handlers.handle("capabilitySetWebSearch", ({ payload }) => manager.update(payload))
handlers.handle("capabilityTestWebSearch", ({ params }) => manager.test(params.provider))
```

- [ ] **Step 4: 运行 API 测试确认通过**

Run: `bun test test/capability/httpapi.test.ts`

Expected: PASS，状态、受管删除边界和密钥脱敏均受验证。

### Task 4: 设置页能力中心

**Files:**
- Create: `packages/app/src/components/settings-v2/capabilities.tsx`
- Create: `packages/app/src/components/settings-v2/capabilities.test.tsx`
- Modify: `packages/app/src/components/settings-v2/dialog-settings-v2.tsx`
- Modify: `packages/app/src/components/settings-v2/settings-v2.css`
- Modify: `packages/app/src/i18n/zh.ts`

**Interfaces:**
- Consumes capability SDK methods from Task 3.
- Produces a settings navigation item named “能力中心” and two tabs: “技能” and “联网搜索”。

- [ ] **Step 1: 写出失败的页面行为测试**

```tsx
test("renders a masked search key status and asks before removing a managed skill", async () => {
  render(() => <SettingsCapabilities client={clientFixture} />)
  expect(screen.getByText("已配置 API Key")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "卸载 skill-a" }))
  expect(screen.getByRole("dialog", { name: "确认卸载 skill-a" })).toBeInTheDocument()
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `bun test src/components/settings-v2/capabilities.test.tsx`

Expected: FAIL，因为能力中心组件尚不存在。

- [ ] **Step 3: 实现紧凑响应式设置页**

```tsx
<Tabs value={tab()} onChange={setTab}>
  <Tabs.List><Tabs.Trigger value="skills">技能</Tabs.Trigger><Tabs.Trigger value="search">联网搜索</Tabs.Trigger></Tabs.List>
  <Tabs.Content value="skills"><SkillList /></Tabs.Content>
  <Tabs.Content value="search"><WebSearchSettings /></Tabs.Content>
</Tabs>
```

技能行在桌面宽度展示开关、详情和菜单；窄宽度将行内操作收纳进菜单。导入、卸载、覆盖更新和启用联网 MCP 均使用确认对话框。

- [ ] **Step 4: 运行页面测试确认通过**

Run: `bun test src/components/settings-v2/capabilities.test.tsx`

Expected: PASS，密钥状态脱敏、卸载确认和窄布局结构均可访问。

### Task 5: 集成验证

**Files:**
- Modify: `E:/DEVECO_CODE_UPDATE_LIST_20260806.md`

- [ ] **Step 1: 运行能力中心相关测试**

Run: `bun test src/capability/skill-manager.test.ts src/capability/websearch-manager.test.ts test/capability/httpapi.test.ts`，随后在 `packages/app` 运行 `bun test src/components/settings-v2/capabilities.test.tsx`。

Expected: PASS。

- [ ] **Step 2: 运行类型检查与桌面构建**

Run: `bun run typecheck`（`packages/opencode`、`packages/app`）与 `bun run build`（`packages/desktop`）。

Expected: 所有命令 exit code 0。

- [ ] **Step 3: 视觉和安全检查**

Run: 在桌面与窄窗口检查能力中心；确认 API Key 不会出现在 UI、配置文件、网络状态响应或日志；确认外部技能没有卸载入口。

- [ ] **Step 4: 更新交接清单并检查差异**

Run: 更新 `E:/DEVECO_CODE_UPDATE_LIST_20260806.md`，然后执行 `git diff --check`。

Expected: exit code 0。
