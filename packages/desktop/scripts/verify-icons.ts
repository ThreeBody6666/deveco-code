import sharp from "sharp"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const dir = join(import.meta.dir, "..", "icons", "dev")
const pngSizes: Array<[string, number]> = [
  ["32x32.png", 32], ["64x64.png", 64], ["128x128.png", 128],
  ["128x128@2x.png", 256], ["icon.png", 512], ["dock.png", 512],
]
for (const [name, size] of pngSizes) {
  const metadata = await sharp(join(dir, name)).metadata()
  if (metadata.width !== size || metadata.height !== size) throw new Error(`${name}: expected ${size}x${size}`)
}
const svg = await readFile(join(dir, "source.svg"), "utf8")
if (/<text\b|<image\b/i.test(svg)) throw new Error("source.svg must remain vector-only without text or external images")
for (const name of ["icon.ico", "icon.icns"]) {
  const bytes = await readFile(join(dir, name))
  if (bytes.length < 16) throw new Error(`${name}: file is unexpectedly small`)
}
console.log("Dev icon assets verified")
