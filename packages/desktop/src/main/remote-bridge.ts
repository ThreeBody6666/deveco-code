import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto"
import { networkInterfaces, tmpdir } from "node:os"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import type { ServerReadyData } from "../preload/types"

const BRIDGE_PORT_ENV = "DEVECO_BRIDGE_PORT"
const DEFAULT_BRIDGE_PORT = 5757
const PAIR_CODE_TTL_MS = 10 * 60 * 1000
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000
const PROTOCOL_VERSION = 2
// A device is reported offline once it misses this long without a heartbeat.
const HEARTBEAT_TIMEOUT_MS = 90 * 1000

type PairCode = { code: string; expiresAt: number }
type Token = { token: string; deviceName: string; issuedAt: number; expiresAt: number; deviceId: string }

// Persisted so a desktop restart no longer invalidates every phone's token.
type PairedDevice = {
  deviceId: string
  deviceName: string
  endpoint?: string
  osVersion?: string
  appVersion?: string
  protocolVersion?: number
  token: string
  issuedAt: number
  expiresAt: number
  lastSeenAt: number
}

type BridgeDeps = {
  getSidecar: () => ServerReadyData | null
  log: (message: string, meta?: Record<string, unknown>) => void
  warn: (message: string, meta?: Record<string, unknown>) => void
  devicesFile?: string
}

export type BridgeInfo = {
  port: number
  hostnames: string[]
  pairCode: string
  pairCodeExpiresAt: number
  pairUrls: string[]
}

export type BridgeController = {
  info: () => BridgeInfo
  regeneratePairCode: () => BridgeInfo
  stop: () => Promise<void>
  onChange: (listener: (info: BridgeInfo) => void) => () => void
}

export function createRemoteBridge(deps: BridgeDeps): Promise<BridgeController> {
  return new Promise((resolve, reject) => {
    const port = readPort()
    const devices = loadDevices(deps)
    const state: {
      pair: PairCode
      tokens: Map<string, Token>
      devices: Map<string, PairedDevice>
    } = {
      pair: generatePairCode(),
      tokens: new Map(),
      devices,
    }
    // Rehydrate tokens from disk so a previously paired phone reconnects silently.
    for (const device of devices.values()) {
      if (device.expiresAt < Date.now()) continue
      state.tokens.set(device.token, {
        token: device.token,
        deviceName: device.deviceName,
        issuedAt: device.issuedAt,
        expiresAt: device.expiresAt,
        deviceId: device.deviceId,
      })
    }
    const listeners = new Set<(info: BridgeInfo) => void>()

    const server = createServer((req, res) => handleRequest(req, res, state, deps))
    server.on("error", (err) => {
      deps.warn("bridge server error", { error: String(err) })
      reject(err)
    })
    server.listen(port, "0.0.0.0", () => {
      const actual = getListeningPort(server, port)
      deps.log("remote-bridge listening", { port: actual })
      const hostnames = getLanHostnames()
      const pairUrls = hostnames.map(
        (h) => `deveco-remote://pair?host=${h}&port=${actual}&code=${state.pair.code}`,
      )
      const lines = [
        "========== DEVECO CODE REMOTE PAIR INFO ==========",
        `Port      : ${actual}`,
        `Pair Code : ${state.pair.code}`,
        `Expires   : ${new Date(state.pair.expiresAt).toLocaleString()}`,
        ...hostnames.map((h) => `Host IP   : ${h}`),
        ...pairUrls.map((u) => `Pair URL  : ${u}`),
        "==================================================",
      ]
      for (const line of lines) deps.log(line)
      try {
        const info = lines.join("\n") + "\n"
        writeFileSync(join(tmpdir(), "deveco-code-pair.txt"), info, "utf-8")
      } catch (err) {
        deps.warn("failed to write pair info file", { error: String(err) })
      }
      resolve(buildController(server, state, listeners, actual))
    })
  })
}

function buildController(
  server: Server,
  state: { pair: PairCode; tokens: Map<string, Token> },
  listeners: Set<(info: BridgeInfo) => void>,
  port: number,
): BridgeController {
  const infoOf = (): BridgeInfo => {
    const hostnames = getLanHostnames()
    return {
      port,
      hostnames,
      pairCode: state.pair.code,
      pairCodeExpiresAt: state.pair.expiresAt,
      pairUrls: hostnames.map((h) => `deveco-remote://pair?host=${h}&port=${port}&code=${state.pair.code}`),
    }
  }
  const notify = () => {
    const snapshot = infoOf()
    try {
      const lines = [
        "========== DEVECO CODE REMOTE PAIR INFO ==========",
        `Port      : ${snapshot.port}`,
        `Pair Code : ${snapshot.pairCode}`,
        `Expires   : ${new Date(snapshot.pairCodeExpiresAt).toLocaleString()}`,
        ...snapshot.hostnames.map((h) => `Host IP   : ${h}`),
        ...snapshot.pairUrls.map((u) => `Pair URL  : ${u}`),
        "==================================================",
      ]
      writeFileSync(join(tmpdir(), "deveco-code-pair.txt"), lines.join("\n") + "\n", "utf-8")
    } catch {}
    for (const fn of listeners) {
      try {
        fn(snapshot)
      } catch {}
    }
  }

  return {
    info: infoOf,
    regeneratePairCode: () => {
      state.pair = generatePairCode()
      notify()
      return infoOf()
    },
    stop: () =>
      new Promise((resolve) => {
        server.close(() => resolve())
      }),
    onChange: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

function readPort() {
  const fromEnv = process.env[BRIDGE_PORT_ENV]
  if (!fromEnv) return DEFAULT_BRIDGE_PORT
  const parsed = Number.parseInt(fromEnv, 10)
  return Number.isNaN(parsed) ? DEFAULT_BRIDGE_PORT : parsed
}

function getListeningPort(server: Server, fallback: number) {
  const addr = server.address()
  if (addr && typeof addr === "object") return addr.port
  return fallback
}

function generatePairCode(): PairCode {
  const digits = randomBytes(3).readUIntBE(0, 3) % 1_000_000
  return {
    code: digits.toString().padStart(6, "0"),
    expiresAt: Date.now() + PAIR_CODE_TTL_MS,
  }
}

function issueToken(deviceName: string, deviceId: string): Token {
  return {
    token: randomBytes(24).toString("base64url"),
    deviceName: deviceName || "unknown-device",
    issuedAt: Date.now(),
    expiresAt: Date.now() + TOKEN_TTL_MS,
    deviceId,
  }
}

function devicesPath(deps: BridgeDeps): string {
  return deps.devicesFile ?? join(tmpdir(), "deveco-code-devices.json")
}

function loadDevices(deps: BridgeDeps): Map<string, PairedDevice> {
  const devices = new Map<string, PairedDevice>()
  try {
    const parsed = JSON.parse(readFileSync(devicesPath(deps), "utf-8")) as PairedDevice[]
    if (!Array.isArray(parsed)) return devices
    for (const device of parsed) {
      if (!device?.deviceId || !device.token) continue
      devices.set(device.deviceId, device)
    }
    deps.log("remote-bridge restored paired devices", { count: devices.size })
  } catch {
    // First run or unreadable file: start with no paired devices.
  }
  return devices
}

function saveDevices(deps: BridgeDeps, devices: Map<string, PairedDevice>) {
  const file = devicesPath(deps)
  try {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify([...devices.values()], null, 2), { encoding: "utf-8", mode: 0o600 })
  } catch (err) {
    deps.warn("failed to persist paired devices", { error: String(err) })
  }
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks).toString("utf8").trim()
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const data = JSON.stringify(body)
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(data),
    "access-control-allow-origin": "*",
  })
  res.end(data)
}

function extractToken(req: IncomingMessage): string | null {
  const raw = req.headers["authorization"]
  if (typeof raw !== "string") return null
  const [scheme, token] = raw.split(" ")
  if (scheme?.toLowerCase() !== "bearer" || !token) return null
  return token
}

type BridgeState = { pair: PairCode; tokens: Map<string, Token>; devices: Map<string, PairedDevice> }

function authorize(req: IncomingMessage, state: BridgeState): Token | null {
  const token = extractToken(req)
  if (!token) return null
  const record = state.tokens.get(token)
  if (!record) return null
  if (record.expiresAt < Date.now()) {
    state.tokens.delete(token)
    return null
  }
  // Any authorized call doubles as liveness, so status stays fresh between heartbeats.
  const device = state.devices.get(record.deviceId)
  if (device) device.lastSeenAt = Date.now()
  return record
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  state: BridgeState,
  deps: BridgeDeps,
) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type,authorization",
      "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    })
    res.end()
    return
  }

  const url = new URL(req.url || "/", "http://x")
  const path = url.pathname
  try {
    if (path === "/bridge/hello" && req.method === "GET") {
      sendJson(res, 200, {
        name: "deveco-code",
        protocol: PROTOCOL_VERSION,
        product: "DevEco Code",
      })
      return
    }
    if (path === "/bridge/pair" && req.method === "POST") {
      const body = await readJson(req)
      if (!body || typeof body.code !== "string" || typeof body.device !== "string") {
        sendJson(res, 400, { error: "invalid_body" })
        return
      }
      if (state.pair.expiresAt < Date.now()) {
        sendJson(res, 410, { error: "pair_code_expired" })
        return
      }
      if (!safeEqual(state.pair.code, body.code.trim())) {
        sendJson(res, 401, { error: "invalid_pair_code" })
        return
      }
      // deviceId lets the phone reconnect later without another QR scan. Older
      // clients that omit it fall back to a server-generated id.
      const deviceId = typeof body.deviceId === "string" && body.deviceId ? body.deviceId : randomUUID()
      const deviceName = typeof body.deviceName === "string" && body.deviceName ? body.deviceName : body.device
      const token = issueToken(deviceName, deviceId)
      state.tokens.set(token.token, token)
      state.devices.set(deviceId, {
        deviceId,
        deviceName,
        endpoint: typeof body.endpoint === "string" ? body.endpoint : undefined,
        osVersion: typeof body.osVersion === "string" ? body.osVersion : undefined,
        appVersion: typeof body.appVersion === "string" ? body.appVersion : undefined,
        protocolVersion: typeof body.protocolVersion === "number" ? body.protocolVersion : undefined,
        token: token.token,
        issuedAt: token.issuedAt,
        expiresAt: token.expiresAt,
        lastSeenAt: Date.now(),
      })
      saveDevices(deps, state.devices)
      state.pair = generatePairCode() // rotate to prevent replay
      sendJson(res, 200, {
        token: token.token,
        expiresAt: token.expiresAt,
        deviceId,
        protocol: PROTOCOL_VERSION,
      })
      return
    }
    // Silent reconnect: the phone proves identity with deviceId + stored token and
    // gets a refreshed expiry. A rejected token means re-pairing is required, and
    // the phone must keep its deviceId either way.
    if (path === "/bridge/reconnect" && req.method === "POST") {
      const body = await readJson(req)
      if (!body || typeof body.deviceId !== "string" || typeof body.token !== "string") {
        sendJson(res, 400, { error: "invalid_body" })
        return
      }
      const device = state.devices.get(body.deviceId)
      if (!device || !safeEqual(device.token, body.token)) {
        sendJson(res, 401, { error: "unauthorized" })
        return
      }
      if (device.expiresAt < Date.now()) {
        state.tokens.delete(device.token)
        sendJson(res, 401, { error: "token_expired" })
        return
      }
      device.expiresAt = Date.now() + TOKEN_TTL_MS
      device.lastSeenAt = Date.now()
      if (typeof body.deviceName === "string" && body.deviceName) device.deviceName = body.deviceName
      if (typeof body.endpoint === "string" && body.endpoint) device.endpoint = body.endpoint
      state.tokens.set(device.token, {
        token: device.token,
        deviceName: device.deviceName,
        issuedAt: device.issuedAt,
        expiresAt: device.expiresAt,
        deviceId: device.deviceId,
      })
      saveDevices(deps, state.devices)
      sendJson(res, 200, {
        token: device.token,
        expiresAt: device.expiresAt,
        deviceId: device.deviceId,
        protocol: PROTOCOL_VERSION,
      })
      return
    }

    // beyond this point requires token
    const token = authorize(req, state)
    if (!token) {
      sendJson(res, 401, { error: "unauthorized" })
      return
    }

    if (path === "/bridge/heartbeat" && req.method === "POST") {
      const device = state.devices.get(token.deviceId)
      if (device) {
        device.lastSeenAt = Date.now()
        saveDevices(deps, state.devices)
      }
      sendJson(res, 200, { ok: true, serverTime: Date.now() })
      return
    }
    // Explicit unpair from the phone's "clear connection info" action.
    if (path === "/bridge/unpair" && req.method === "POST") {
      state.tokens.delete(token.token)
      state.devices.delete(token.deviceId)
      saveDevices(deps, state.devices)
      sendJson(res, 200, { ok: true })
      return
    }

    if (path === "/bridge/sessions" && req.method === "GET") {
      const data = await proxySidecar(deps, "GET", "/session")
      sendJson(res, data.status, data.body)
      return
    }
    if (path.startsWith("/bridge/sessions/") && req.method === "GET") {
      const id = path.slice("/bridge/sessions/".length).split("/")[0]
      const suffix = path.slice(`/bridge/sessions/${id}`.length)
      if (suffix === "/messages") {
        const data = await proxySidecar(deps, "GET", `/session/${encodeURIComponent(id)}/message`)
        sendJson(res, data.status, data.body)
        return
      }
    }
    if (path.match(/^\/bridge\/sessions\/[^/]+\/message$/) && req.method === "POST") {
      const id = path.split("/")[3]
      const body = await readJson(req)
      const data = await proxySidecar(deps, "POST", `/session/${encodeURIComponent(id)}/message`, body)
      sendJson(res, data.status, data.body)
      return
    }
    // Long poll replacing the mobile client's fixed 5s interval. Holds the request
    // until the session gains a message newer than `since`, or the wait budget ends.
    if (path === "/bridge/events" && req.method === "GET") {
      const sessionID = url.searchParams.get("session")
      if (!sessionID) {
        sendJson(res, 400, { error: "invalid_body" })
        return
      }
      const since = Number.parseInt(url.searchParams.get("since") || "0", 10)
      const data = await waitForSessionMessages(
        deps,
        sessionID,
        Number.isFinite(since) ? since : 0,
        Number.parseInt(url.searchParams.get("wait") || "", 10),
        () => req.destroyed,
      )
      sendJson(res, data.status, data.body)
      return
    }
    if (path === "/bridge/permissions" && req.method === "GET") {
      const data = await proxySidecar(deps, "GET", "/permission")
      sendJson(res, data.status, data.body)
      return
    }
    if (path.match(/^\/bridge\/permissions\/[^/]+\/answer$/) && req.method === "POST") {
      const id = path.split("/")[3]
      const body = await readJson(req)
      if (!body || typeof body.reply !== "string") {
        sendJson(res, 400, { error: "invalid_body" })
        return
      }
      const data = await proxySidecar(deps, "POST", `/permission/${encodeURIComponent(id)}/reply`, {
        reply: body.reply,
        message: typeof body.message === "string" ? body.message : undefined,
      })
      sendJson(res, data.status, data.body)
      return
    }
    if (path === "/bridge/projects" && req.method === "GET") {
      const data = await proxySidecar(deps, "GET", "/project")
      sendJson(res, data.status, data.body)
      return
    }
    if (path === "/bridge/whoami" && req.method === "GET") {
      sendJson(res, 200, { device: token.deviceName, issuedAt: token.issuedAt, deviceId: token.deviceId })
      return
    }
    sendJson(res, 404, { error: "not_found", path })
  } catch (err) {
    deps.warn("bridge request failed", { error: String(err), path })
    sendJson(res, 500, { error: "internal_error" })
  }
}

async function proxySidecar(
  deps: BridgeDeps,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const sidecar = deps.getSidecar()
  if (!sidecar) return { status: 503, body: { error: "sidecar_not_ready" } }
  const auth = Buffer.from(`${sidecar.username}:${sidecar.password}`).toString("base64")
  const headers: Record<string, string> = {
    accept: "application/json",
    authorization: `Basic ${auth}`,
  }
  let payload: BodyInit | undefined
  if (body !== undefined) {
    headers["content-type"] = "application/json"
    payload = JSON.stringify(body)
  }
  try {
    const res = await fetch(new URL(path, sidecar.url), {
      method,
      headers,
      body: payload,
      signal: AbortSignal.timeout(30_000),
    })
    const text = await res.text()
    let parsed: unknown = null
    if (text) {
      try {
        parsed = JSON.parse(text)
      } catch {
        parsed = { raw: text }
      }
    }
    return { status: res.status, body: parsed }
  } catch (err) {
    return { status: 502, body: { error: "sidecar_unreachable", detail: String(err) } }
  }
}

// Long-poll helper: repeatedly reads the session messages until one is newer than
// `since`, so mobile clients get near-realtime updates without a WebSocket upgrade.
async function waitForSessionMessages(
  deps: BridgeDeps,
  sessionID: string,
  since: number,
  waitSeconds: number,
  aborted: () => boolean,
): Promise<{ status: number; body: unknown }> {
  const budgetMs = Math.min(Math.max(Number.isFinite(waitSeconds) ? waitSeconds : 25, 1), 55) * 1000
  const deadline = Date.now() + budgetMs
  while (true) {
    const data = await proxySidecar(deps, "GET", `/session/${encodeURIComponent(sessionID)}/message`)
    if (data.status !== 200) return data
    const latest = latestMessageTime(data.body)
    if (latest > since) return { status: 200, body: { latest, messages: data.body } }
    if (aborted() || Date.now() >= deadline) return { status: 200, body: { latest: since, messages: [] } }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}

function latestMessageTime(body: unknown): number {
  if (!Array.isArray(body)) return 0
  // Sidecar returns `{ info, parts }` envelopes; older shapes are flat messages.
  return body.reduce<number>((max, item) => {
    const time = (item?.info?.time ?? item?.time) as { created?: number; completed?: number } | undefined
    return Math.max(max, time?.completed ?? 0, time?.created ?? 0)
  }, 0)
}

function getLanHostnames(): string[] {
  const results: string[] = []
  const nets = networkInterfaces()
  for (const [, ifaces] of Object.entries(nets)) {
    if (!ifaces) continue
    for (const iface of ifaces) {
      if (iface.family !== "IPv4") continue
      if (iface.internal) continue
      results.push(iface.address)
    }
  }
  return results
}

export function noopBridgeInfo(): BridgeInfo {
  return {
    port: 0,
    hostnames: [],
    pairCode: "",
    pairCodeExpiresAt: 0,
    pairUrls: [],
  }
}

export const __internal = { generatePairCode, issueToken, safeEqual, __version: randomUUID }
