import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto"
import { networkInterfaces, tmpdir } from "node:os"
import { writeFileSync } from "node:fs"
import { join } from "node:path"

import type { ServerReadyData } from "../preload/types"

const BRIDGE_PORT_ENV = "DEVECO_BRIDGE_PORT"
const DEFAULT_BRIDGE_PORT = 5757
const PAIR_CODE_TTL_MS = 10 * 60 * 1000
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

type PairCode = { code: string; expiresAt: number }
type Token = { token: string; deviceName: string; issuedAt: number; expiresAt: number }

type BridgeDeps = {
  getSidecar: () => ServerReadyData | null
  log: (message: string, meta?: Record<string, unknown>) => void
  warn: (message: string, meta?: Record<string, unknown>) => void
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
    const state: {
      pair: PairCode
      tokens: Map<string, Token>
    } = {
      pair: generatePairCode(),
      tokens: new Map(),
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
  return Number.isFinite(parsed) ? parsed : DEFAULT_BRIDGE_PORT
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

function issueToken(deviceName: string): Token {
  return {
    token: randomBytes(24).toString("base64url"),
    deviceName: deviceName || "unknown-device",
    issuedAt: Date.now(),
    expiresAt: Date.now() + TOKEN_TTL_MS,
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

function authorize(
  req: IncomingMessage,
  state: { tokens: Map<string, Token> },
): Token | null {
  const token = extractToken(req)
  if (!token) return null
  const record = state.tokens.get(token)
  if (!record) return null
  if (record.expiresAt < Date.now()) {
    state.tokens.delete(token)
    return null
  }
  return record
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  state: { pair: PairCode; tokens: Map<string, Token> },
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
      sendJson(res, 200, { name: "deveco-code", protocol: 1, product: "DevEco Code" })
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
      const token = issueToken(body.device)
      state.tokens.set(token.token, token)
      state.pair = generatePairCode() // rotate to prevent replay
      sendJson(res, 200, { token: token.token, expiresAt: token.expiresAt })
      return
    }

    // beyond this point requires token
    const token = authorize(req, state)
    if (!token) {
      sendJson(res, 401, { error: "unauthorized" })
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
    if (path === "/bridge/projects" && req.method === "GET") {
      const data = await proxySidecar(deps, "GET", "/project")
      sendJson(res, data.status, data.body)
      return
    }
    if (path === "/bridge/whoami" && req.method === "GET") {
      sendJson(res, 200, { device: token.deviceName, issuedAt: token.issuedAt })
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
