#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

const rootPkgPath = resolve(process.cwd(), "package.json")
const desktopPkgPath = resolve(process.cwd(), "packages", "desktop", "package.json")

function bump(version) {
  const parts = version.split(".")
  const patch = parseInt(parts[2], 10)
  if (Number.isNaN(patch)) throw new Error(`Invalid version: ${version}`)
  parts[2] = String(patch + 1)
  return parts.join(".")
}

async function update(path) {
  const content = await readFile(path, "utf8")
  const pkg = JSON.parse(content)
  const next = bump(pkg.version)
  pkg.version = next
  await writeFile(path, JSON.stringify(pkg, null, 2) + "\n")
  return next
}

const rootVersion = await update(rootPkgPath)
const desktopVersion = await update(desktopPkgPath)
console.log(`[bump-version] ${rootVersion} (root + desktop)`)

if (rootVersion !== desktopVersion) {
  throw new Error(`Version mismatch: root=${rootVersion}, desktop=${desktopVersion}`)
}
