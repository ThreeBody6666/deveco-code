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
import path from "path"
import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import { devEcoHomeMissingMessage, getDevEcoHome, studioBinaryPath } from "./lib/deveco-home"
import DESCRIPTION from "./harmony-open-studio.txt"

const Parameters = Schema.Struct({
  project_path: Schema.String.annotate({ description: "Absolute path of the project folder to open in DevEco Studio" }),
})

interface HarmonyOpenStudioMetadata {
  projectPath?: string
  binary?: string
}

/* Studio keeps running after this returns, so the child is detached and unref'd rather than awaited. */
function launch(binary: string, project: string) {
  const proc = Bun.spawn({ cmd: [binary, project], stdin: "ignore", stdout: "ignore", stderr: "ignore", detached: true })
  proc.unref()
  return Promise.resolve()
}

export const HarmonyOpenStudioTool = Tool.define(
  "harmony_open_studio",
  Effect.gen(function* () {
    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (args: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context<HarmonyOpenStudioMetadata>) =>
        Effect.gen(function* () {
          const project = args.project_path.trim()
          if (!path.isAbsolute(project)) throw new Error(`project_path must be an absolute path: ${project}`)

          const info = yield* Effect.tryPromise(() => fs.stat(project).catch(() => undefined))
          if (!info?.isDirectory()) throw new Error(`Project directory not found: ${project}`)

          const outcome = yield* Effect.tryPromise(() => getDevEcoHome())
          if (!outcome.ok) throw new Error(devEcoHomeMissingMessage(outcome))

          const binary = studioBinaryPath(outcome.home)
          if (!(yield* Effect.tryPromise(() => Bun.file(binary).exists()))) {
            throw new Error(`DevEco Studio launcher not found: ${binary}`)
          }

          yield* ctx.ask({
            permission: "harmony_open_studio",
            patterns: [project],
            always: [project],
            metadata: { projectPath: project, binary },
          })

          yield* Effect.tryPromise(() => launch(binary, project))
          return {
            title: `Opening ${path.basename(project)} in DevEco Studio`,
            output: [`Started ${binary}`, `project: ${project}`, `devEcoHome: ${outcome.home}`].join("\n"),
            metadata: { projectPath: project, binary } satisfies HarmonyOpenStudioMetadata,
          }
        }).pipe(Effect.orDie),
    }
  }),
)
