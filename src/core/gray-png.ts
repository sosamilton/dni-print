// Minimal 8-bit grayscale PNG writer (stored deflate blocks, no compression).
// jsPDF re-compresses it and embeds it with ColorSpace DeviceGray (AD-18);
// canvas JPEG encoders always emit 3 components, so they cannot do that.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function adler32(bytes: Uint8Array): number {
  let a = 1
  let b = 0
  for (const v of bytes) {
    a = (a + v) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, body.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(body, 8)
  view.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)))
  return out
}

/** Encodes `gray` (width*height bytes, row-major) as a grayscale PNG. */
export function encodeGrayPng(width: number, height: number, gray: Uint8Array): Uint8Array {
  const raw = new Uint8Array((width + 1) * height) // each row: filter byte 0 + pixels
  for (let y = 0; y < height; y++) raw.set(gray.subarray(y * width, (y + 1) * width), y * (width + 1) + 1)

  const blocks = Math.max(1, Math.ceil(raw.length / 65535))
  const zlib = new Uint8Array(2 + raw.length + blocks * 5 + 4)
  zlib[0] = 0x78
  zlib[1] = 0x01
  let o = 2
  for (let i = 0; i < blocks; i++) {
    const part = raw.subarray(i * 65535, (i + 1) * 65535)
    zlib[o++] = i === blocks - 1 ? 1 : 0
    zlib[o++] = part.length & 255
    zlib[o++] = part.length >> 8
    zlib[o++] = ~part.length & 255
    zlib[o++] = (~part.length >> 8) & 255
    zlib.set(part, o)
    o += part.length
  }
  new DataView(zlib.buffer).setUint32(o, adler32(raw))

  const ihdr = new Uint8Array(13)
  const view = new DataView(ihdr.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 0 // grayscale
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib),
    chunk('IEND', new Uint8Array(0)),
  ]
  const png = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    png.set(p, at)
    at += p.length
  }
  return png
}
