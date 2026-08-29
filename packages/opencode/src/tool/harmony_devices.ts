/*
 * Copyright (c) 2026 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from "fs/promises"
import os from "node:os"
import path from "path"
import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import { devEcoHomeMissingMessage, getDevEcoHome, hdcPath } from "./lib/deveco-home"
import DESCRIPTION from "./harmony-devices.txt"

const Parameters = Schema.Struct({})

const HDC_TIMEOUT_MS = 5_000

interface HarmonyDevicesMetadata {
  liveCount?: number
  imageCount?: number
}

interface Report {
  title: string
  output: string
  liveCount: number
  imageCount: number
}

interface Image {
  name: string
  detail: string
}

/* Only the Windows location is confirmed by a real install; the others are reported as
 * not-found rather than guessed further. */
function deployedRoot() {
  if (process.platform === "win32") {
    const local = String(process.env.LOCALAPPDATA || "").trim()
    return local ? path.join(local, "Huawei", "Emulator", "deployed") : ""
  }
  const home = String(process.env.HOME || os.homedir() || "").trim()
  if (!home) return ""
  if (process.platform === "darwin") return path.join(home, "Library", "Application Support", "Huawei", "Emulator", "deployed")
  return path.join(home, ".local", "share", "Huawei", "Emulator", "deployed")
}

async function runWithTimeout(cmd: string[]) {
  const proc = Bun.spawn({ cmd, stdout: "pipe", stderr: "pipe" })
  const timer = setTimeout(() => proc.kill(), HDC_TIMEOUT_MS)
  timer.unref?.()
  try {
    const [stdout, stderr] = await Promise.all([
      proc.stdout ? Bun.readableStreamToText(proc.stdout).catch(() => "") : Promise.resolve(""),
      proc.stderr ? Bun.readableStreamToText(proc.stderr).catch(() => "") : Promise.resolve(""),
    ])
    await proc.exited.catch(() => undefined)
    return { stdout, stderr }
  } finally {
    clearTimeout(timer)
  }
}

function lines(text: string) {
  return text
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item && !item.includes("[Empty]"))
}

function toImage(value: unknown): Image | undefined {
  if (!value || typeof value !== "object") return undefined
  const record = value as Record<string, unknown>
  const name = typeof record.name === "string" ? record.name.trim() : ""
  if (!name) return undefined
  const detail = [
    typeof record.type === "string" ? record.type : "",
    typeof record.apiVersion === "string" ? `API ${record.apiVersion}` : "",
    typeof record.showVersion === "string" ? record.showVersion : "",
  ]
    .filter(Boolean)
    .join(", ")
  return { name, detail }
}

async function images(root: string): Promise<Image[]> {
  if (!root) return []
  const text = await fs.readFile(path.join(root, "lists.json"), "utf8").catch(() => undefined)
  if (!text) return []
  const parsed: unknown = JSON.parse(text)
  return Array.isArray(parsed) ? parsed.map(toImage).filter((item): item is Image => Boolean(item)) : []
}

async function collect(): Promise<Report> {
  const outcome = await getDevEcoHome()
  const root = deployedRoot()
  const installed = await images(root).catch(() => [])
  const report: string[] = []
  let live: string[] = []

  if (!outcome.ok) {
    report.push(devEcoHomeMissingMessage(outcome))
    report.push("Live targets need hdc, which ships inside the DevEco Studio SDK.")
  } else {
    const hdc = hdcPath(outcome.home)
    if (!(await Bun.file(hdc).exists())) {
      report.push(`hdc not found at ${hdc}; live targets are unknown.`)
    } else {
      const out = await runWithTimeout([hdc, "list", "targets"])
      live = lines(out.stdout)
      if (live.length) {
        report.push(`Live targets (${live.length}) via hdc:`)
        live.forEach((item, index) => report.push(`${index + 1}. ${item}`))
      } else {
        report.push("No live hdc targets.")
        const detail = out.stderr.trim() || out.stdout.trim()
        if (detail) report.push(`hdc said: ${detail}`)
      }
    }
  }

  if (installed.length) {
    report.push(`Installed emulator images (${installed.length}) in ${root}:`)
    installed.forEach((image, index) => {
      const match = live.find((target) => target.includes(image.name))
      report.push(`${index + 1}. ${image.name}${image.detail ? ` — ${image.detail}` : ""}${match ? ` [live as ${match}]` : ""}`)
    })
    if (live.length && !installed.some((image) => live.some((target) => target.includes(image.name)))) {
      report.push(
        "No live target matched an installed image name; live entries may be physical devices or emulators addressed by serial.",
      )
    }
  } else {
    report.push(root ? `No installed emulator images recorded in ${root}.` : "Cannot locate an emulator deployment directory on this platform.")
  }

  return {
    title: live.length ? `${live.length} live target(s)` : "No live targets",
    output: report.join("\n"),
    liveCount: live.length,
    imageCount: installed.length,
  }
}

export const HarmonyDevicesTool = Tool.define(
  "harmony_devices",
  Effect.gen(function* () {
    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (_args: Schema.Schema.Type<typeof Parameters>, _ctx: Tool.Context<HarmonyDevicesMetadata>) =>
        Effect.gen(function* () {
          const report = yield* Effect.tryPromise(() => collect())
          return {
            title: report.title,
            output: report.output,
            metadata: { liveCount: report.liveCount, imageCount: report.imageCount } satisfies HarmonyDevicesMetadata,
          }
        }).pipe(Effect.orDie),
    }
  }),
)
