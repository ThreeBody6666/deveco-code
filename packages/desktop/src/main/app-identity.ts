export type AppChannel = "dev" | "beta" | "prod"

const DATA_IDS: Record<AppChannel, string> = {
  dev: "ai.opencode.desktop.dev",
  beta: "ai.opencode.desktop.beta",
  prod: "ai.opencode.desktop",
}

const SHELL_IDS: Record<AppChannel, string> = {
  dev: "ai.deveco.code.desktop.dev",
  beta: "ai.deveco.code.desktop.beta",
  prod: "ai.deveco.code.desktop",
}

export function appIdentity(channel: AppChannel, packaged: boolean) {
  const dataId = packaged ? DATA_IDS[channel] : DATA_IDS.dev
  const shellId = packaged ? SHELL_IDS[channel] : SHELL_IDS.dev
  return { dataId, shellId }
}
