import { rm } from "node:fs/promises"
import path from "node:path"

export namespace SkillManager {
  export type Options = {
    root: string
  }

  export function make(options: Options) {
    const root = path.resolve(options.root)

    const managed = (location: string) => {
      const relative = path.relative(root, path.resolve(location))
      return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
    }

    return {
      async uninstall(_name: string, location: string) {
        if (!managed(location)) throw new Error("Skill is outside the managed skills root")
        await rm(path.dirname(location), { recursive: true, force: true })
      },
    }
  }
}
