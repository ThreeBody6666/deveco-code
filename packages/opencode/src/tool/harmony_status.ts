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
import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import {
  devEcoHomeMissingMessage,
  devEcoHomeWarning,
  emulatorLauncherPath,
  getDevEcoHome,
  hdcPath,
  sdkPath,
  studioBinaryPath,
  UI_VERIFY_ENV,
  type DevEcoHomeSource,
} from "./lib/deveco-home"
import DESCRIPTION from "./harmony-status.txt"

const Parameters = Schema.Struct({})

interface HarmonyStatusMetadata {
  home?: string
  source?: DevEcoHomeSource
}

interface Report {
  title: string
  output: string
  home?: string
  source?: DevEcoHomeSource
}

async function kind(target: string) {
  const info = await fs.stat(target).catch(() => undefined)
  if (!info) return "missing"
  return info.isDirectory() ? "directory" : "file"
}

async function entry(label: string, target: string) {
  return `${label}: ${target} [${await kind(target)}]`
}

async function collect(): Promise<Report> {
  const outcome = await getDevEcoHome()

  if (!outcome.ok) {
    const lines = [devEcoHomeMissingMessage(outcome)]
    for (const rejection of outcome.rejections) {
      lines.push(`rejected ${rejection.path}: ${rejection.reason}`)
    }
    return { title: "DevEco Studio Not Found", output: lines.join("\n") }
  }

  const lines = [
    `home: ${outcome.home}`,
    `resolved from: ${outcome.source} (product version ${outcome.version})`,
  ]
  const warning = devEcoHomeWarning(outcome)
  if (warning) lines.push(`warning: ${warning}`)

  lines.push(await entry("sdk", sdkPath(outcome.home)))
  lines.push(await entry("hdc", hdcPath(outcome.home)))
  lines.push(await entry("emulator", emulatorLauncherPath(outcome.home)))
  lines.push(await entry("studio", studioBinaryPath(outcome.home)))

  const configured = UI_VERIFY_ENV.filter((name) => process.env[name]?.trim())
  lines.push(
    configured.length === UI_VERIFY_ENV.length
      ? "ui_verification: endpoint configured from the environment"
      : `ui_verification: environment endpoint not configured (${UI_VERIFY_ENV.length - configured.length} of ${UI_VERIFY_ENV.length} variables missing); verify_ui still falls back to the ui_verification agent model or a signed-in account`,
  )

  return { title: `DevEco Studio ${outcome.version}`, output: lines.join("\n"), home: outcome.home, source: outcome.source }
}

export const HarmonyStatusTool = Tool.define(
  "harmony_status",
  Effect.gen(function* () {
    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (_args: Schema.Schema.Type<typeof Parameters>, _ctx: Tool.Context<HarmonyStatusMetadata>) =>
        Effect.gen(function* () {
          const report = yield* Effect.tryPromise(collect)
          return {
            title: report.title,
            output: report.output,
            metadata: { home: report.home, source: report.source } satisfies HarmonyStatusMetadata,
          }
        }).pipe(Effect.orDie),
    }
  }),
)
