import { deflateSync } from 'node:zlib'

function crc32(buf: Buffer): number {
  let c = ~0
  for (const b of buf) {
    c ^= b
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** Synthetic solid-color RGB PNG, generated in code (never a real photo). */
export function syntheticPng(widthPx = 120, heightPx = 80, rgb: [number, number, number] = [60, 120, 200]): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(widthPx, 0)
  header.writeUInt32BE(heightPx, 4)
  header[8] = 8
  header[9] = 2
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: widthPx }, () => rgb).flat())])
  const raw = Buffer.concat(Array.from({ length: heightPx }, () => row))
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

export const pngFile = (name = 'foto.png') => ({ name, mimeType: 'image/png', buffer: syntheticPng() })
export const textFile = () => ({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('hola') })
