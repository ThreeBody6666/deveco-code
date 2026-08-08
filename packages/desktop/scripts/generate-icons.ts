import sharp from "sharp"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"

const dir = join(import.meta.dir, "..", "icons", "dev")
const source = join(dir, "source.svg")
const sizes = [16, 24, 32, 48, 64, 128, 256, 512]

await mkdir(dir, { recursive: true })
const pngs = new Map<number, Buffer>()
for (const size of sizes) {
  const png = await sharp(source).resize(size, size).png().toBuffer()
  pngs.set(size, png)
}

await Bun.write(join(dir, "32x32.png"), pngs.get(32)!)
await Bun.write(join(dir, "64x64.png"), pngs.get(64)!)
await Bun.write(join(dir, "128x128.png"), pngs.get(128)!)
await Bun.write(join(dir, "128x128@2x.png"), pngs.get(256)!)
await Bun.write(join(dir, "icon.png"), pngs.get(512)!)
await Bun.write(join(dir, "dock.png"), pngs.get(512)!)

const icoSizes = [16, 24, 32, 48, 64, 128, 256]
const icoHeader = Buffer.alloc(6)
icoHeader.writeUInt16LE(0, 0)
icoHeader.writeUInt16LE(1, 2)
icoHeader.writeUInt16LE(icoSizes.length, 4)
const icoEntries: Buffer[] = []
let offset = 6 + icoSizes.length * 16
for (const size of icoSizes) {
  const png = pngs.get(size)!
  const entry = Buffer.alloc(16)
  entry[0] = size === 256 ? 0 : size
  entry[1] = size === 256 ? 0 : size
  entry[2] = 0
  entry[3] = 0
  entry.writeUInt16LE(1, 4)
  entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(offset, 12)
  icoEntries.push(entry)
  offset += png.length
}
await Bun.write(join(dir, "icon.ico"), Buffer.concat([icoHeader, ...icoEntries, ...icoSizes.map((size) => pngs.get(size)!)]))

const icnsParts: Buffer[] = []
const icnsSizes: Array<[string, number]> = [["icp4", 16], ["icp5", 32], ["icp6", 48], ["ic07", 128], ["ic08", 256], ["ic09", 512]]
for (const [type, size] of icnsSizes) {
  const png = pngs.get(size)!
  const header = Buffer.alloc(8)
  header.write(type, 0, 4, "ascii")
  header.writeUInt32BE(png.length + 8, 4)
  icnsParts.push(header, png)
}
const icnsLength = 8 + icnsParts.reduce((sum, part) => sum + part.length, 0)
const icnsHeader = Buffer.alloc(8)
icnsHeader.write("icns", 0, 4, "ascii")
icnsHeader.writeUInt32BE(icnsLength, 4)
await Bun.write(join(dir, "icon.icns"), Buffer.concat([icnsHeader, ...icnsParts]))

console.log(`Generated ${pngs.size + 2} icon assets from ${source}`)
