import { ipcMain, shell } from "electron"
import type { IpcMainInvokeEvent } from "electron"

import type { EnvDoctorController } from "./index"
import type { EnvDoctorComponentId } from "./detect"

export function registerEnvDoctorIpc(controller: EnvDoctorController) {
  ipcMain.handle("env-doctor-scan", () => controller.scan())
  ipcMain.handle("env-doctor-set-studio-path", (_e: IpcMainInvokeEvent, path: string) => controller.setStudioPath(path))
  ipcMain.handle("env-doctor-clear-studio-path", () => controller.clearStudioPath())
  ipcMain.handle("env-doctor-install-guide", (_e: IpcMainInvokeEvent, id: EnvDoctorComponentId) =>
    controller.installGuide(id),
  )
  ipcMain.handle("env-doctor-open-install", async (_e: IpcMainInvokeEvent, id: EnvDoctorComponentId) => {
    const guide = controller.installGuide(id)
    if (guide?.url) await shell.openExternal(guide.url)
    return guide
  })
  ipcMain.handle("env-doctor-components", () => controller.components())
}
