import { getFilename } from "@opencode-ai/core/util/path"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { type Session } from "@opencode-ai/sdk/v2/client"
import { pathKey } from "@/utils/path-key"
import type { ServerConnection } from "@/context/server"

type SessionStore = {
  session?: Session[]
  path: { directory: string }
}

function sortSessions(now: number) {
  const oneMinuteAgo = now - 60 * 1000
  return (a: Session, b: Session) => {
    const aUpdated = a.time.updated ?? a.time.created
    const bUpdated = b.time.updated ?? b.time.created
    const aRecent = aUpdated > oneMinuteAgo
    const bRecent = bUpdated > oneMinuteAgo
    if (aRecent && bRecent) return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    if (aRecent && !bRecent) return -1
    if (!aRecent && bRecent) return 1
    return bUpdated - aUpdated
  }
}

const isRootVisibleSession = (session: Session, directory: string) =>
  pathKey(session.directory) === pathKey(directory) && !session.parentID && !session.time?.archived

export const roots = (store: SessionStore) =>
  (store.session ?? []).filter((session) => isRootVisibleSession(session, store.path.directory))

export const sortedRootSessions = (store: SessionStore, now: number) => roots(store).sort(sortSessions(now))

export const latestRootSession = (stores: SessionStore[], now: number) =>
  stores.flatMap(roots).sort(sortSessions(now))[0]

export function hasProjectPermissions<T>(
  request: Record<string, T[] | undefined> | undefined,
  include: (item: T) => boolean = () => true,
) {
  return Object.values(request ?? {}).some((list) => list?.some(include))
}

export const childSessionOnPath = (sessions: Session[] | undefined, rootID: string, activeID?: string) => {
  if (!activeID || activeID === rootID) return
  const map = new Map((sessions ?? []).map((session) => [session.id, session]))
  let id = activeID

  while (id) {
    const session = map.get(id)
    if (!session?.parentID) return
    if (session.parentID === rootID) return session
    id = session.parentID
  }
}

export const displayName = (project: { name?: string; worktree: string }) =>
  project.name || getFilename(project.worktree) || project.worktree

export type HomeProjectSelection = { server: ServerConnection.Key; directory?: string }

export function toggleHomeProjectSelection(
  current: HomeProjectSelection | undefined,
  server: ServerConnection.Key,
  directory: string,
): HomeProjectSelection {
  if (current?.server === server && current.directory === directory) return { server }
  return { server, directory }
}

export function closeHomeProject(
  selected: HomeProjectSelection | undefined,
  server: ServerConnection.Key,
  projects: { close: (directory: string) => void },
  directory: string,
) {
  projects.close(directory)
  if (selected?.server === server && selected.directory === directory) return { server }
  return selected
}

export function homeProjectNavigation(active: ServerConnection.Key, server: ServerConnection.Key, href: string) {
  if (active === server) return { href }
  return { server, href }
}

export const homeNewTaskPrompt = () => "请先帮我为这个项目新建一个任务计划，拆分目标、步骤和验证方式。"

export const homeNewProjectPrompt = () =>
  "请作为 DevEco Code 的项目创建向导，当前会话目录就是新项目的存放目录。先确认我要创建的项目名称、应用类型和目标平台；如果我要创建 HarmonyOS 或 ArkTS 项目，必须使用 deveco-create-project skill 执行实际创建，这相当于走 deveco create 新建工程流程，不要只给方案或手动复制文件。创建前按 skill 规则确认 appName；创建成功后再继续后续页面或功能实现。"

export function homeNewSessionHref(directory: string, prompt?: string) {
  const href = `/${base64Encode(directory)}/session`
  const trimmed = prompt?.trim()
  if (!trimmed) return href
  return `${href}?prompt=${encodeURIComponent(trimmed)}`
}

export function homeProjectDirectories(result: string | string[] | null) {
  if (!result) return []
  return Array.isArray(result) ? result : [result]
}

export type HomeWorkbenchStat = {
  id: "project" | "sessions" | "projects" | "status"
  label: string
  value: string
  tone: "base" | "muted" | "success" | "warning"
}

export function homeWorkbenchStatusLabel(healthy: boolean | undefined) {
  if (healthy === true) return "已连接"
  if (healthy === false) return "未连接"
  return "连接中"
}

export function homeWorkbenchStats(input: {
  projects: number
  sessions: number
  selectedProject?: string
  healthy?: boolean
}): HomeWorkbenchStat[] {
  return [
    {
      id: "project",
      label: "当前项目",
      value: input.selectedProject || "未选择",
      tone: input.selectedProject ? "base" : "muted",
    },
    { id: "sessions", label: "会话", value: String(input.sessions), tone: "base" },
    { id: "projects", label: "项目", value: String(input.projects), tone: "base" },
    {
      id: "status",
      label: "服务",
      value: homeWorkbenchStatusLabel(input.healthy),
      tone: input.healthy === true ? "success" : input.healthy === false ? "warning" : "muted",
    },
  ]
}

export function homeSessionServerStatus(active: boolean, status: () => { working: boolean; tint?: string }) {
  if (!active) return { working: false, tint: undefined }
  return status()
}

const DEVECO_PROJECT_ID = "4b0ea68d7af9a6031a7ffda7ad66e0cb83315750"

export function getProjectAvatarSource(id?: string, icon?: { color?: string; url?: string; override?: string }) {
  if (id === DEVECO_PROJECT_ID) return "https://opencode.ai/favicon.svg"
  if (icon?.override) return icon.override
  if (icon?.color) return undefined
  return icon?.url
}

export function projectForSession<T extends { id?: string; worktree: string; sandboxes?: string[] }>(
  session: Session,
  projects: T[],
  byID: Map<string, T> = new Map(projects.flatMap((project) => (project.id ? [[project.id, project] as const] : []))),
) {
  const direct = byID.get(session.projectID)
  if (direct) return direct
  const directory = pathKey(session.directory)
  return projects.find(
    (project) =>
      pathKey(project.worktree) === directory || project.sandboxes?.some((sandbox) => pathKey(sandbox) === directory),
  )
}

export const errorMessage = (err: unknown, fallback: string) => {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: { message?: string } }).data
    if (data?.message) return data.message
  }
  if (err instanceof Error) return err.message
  return fallback
}

export const effectiveWorkspaceOrder = (local: string, dirs: string[], persisted?: string[]) => {
  const root = pathKey(local)
  const live = new Map<string, string>()

  for (const dir of dirs) {
    const key = pathKey(dir)
    if (key === root) continue
    if (!live.has(key)) live.set(key, dir)
  }

  if (!persisted?.length) return [local, ...live.values()]

  const result = [local]
  for (const dir of persisted) {
    const key = pathKey(dir)
    if (key === root) continue
    const match = live.get(key)
    if (!match) continue
    result.push(match)
    live.delete(key)
  }

  return [...result, ...live.values()]
}
