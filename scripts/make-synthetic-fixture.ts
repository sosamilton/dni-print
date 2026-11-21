// Generates tests/fixtures/synthetic-card.png and its .quad.json (no personal data: a plain rectangle on a dark background).
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const W = 800
const H = 560
const QUAD = [[120, 90], [690, 110], [670, 470], [100, 450]]

function crc32(buf: Uint8Array): number {
  let c = ~0
  for (const b of buf) {
    c ^= b
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}
function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  out.set(data, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}
const inside = (x: number, y: number): boolean => {
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = QUAD[i]
    const [bx, by] = QUAD[(i + 1) % 4]
    if ((bx - ax) * (y - ay) - (by - ay) * (x - ax) < 0) return false
  }
  return true
}
const raw = Buffer.alloc((W * 3 + 1) * H)
for (let y = 0; y < H; y++) {
  raw[y * (W * 3 + 1)] = 0
  for (let x = 0; x < W; x++) {
    const v = inside(x + 0.5, y + 0.5) ? 235 : 40
    raw.fill(v, y * (W * 3 + 1) + 1 + x * 3, y * (W * 3 + 1) + 4 + x * 3)
  }
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0)
ihdr.writeUInt32BE(H, 4)
ihdr.set([8, 2, 0, 0, 0], 8)
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', new Uint8Array()),
])
writeFileSync('tests/fixtures/synthetic-card.png', png)
writeFileSync('tests/fixtures/synthetic-card.quad.json', JSON.stringify(QUAD) + '\n')
