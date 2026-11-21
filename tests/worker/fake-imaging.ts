import type { BitmapLike } from '../../src/core/index.ts'
import type { ImagingBackend } from '../../src/worker/processing-api.ts'

export interface FakeBitmap extends BitmapLike {
  closed: boolean
}

export function fakeBitmap(width: number, height: number): FakeBitmap {
  return {
    width,
    height,
    closed: false,
    close() {
      this.closed = true
    },
  }
}

export function createFakeImaging(): ImagingBackend & { made: FakeBitmap[] } {
  const made: FakeBitmap[] = []
  const track = (b: FakeBitmap) => (made.push(b), b)
  return {
    made,
    async decode(blob) {
      const m = /^(\d+)x(\d+)$/.exec(await blob.text())
      return m ? track(fakeBitmap(Number(m[1]), Number(m[2]))) : null
    },
    async scaleTo(bitmap, max) {
      const k = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
      return track(fakeBitmap(Math.round(bitmap.width * k), Math.round(bitmap.height * k)))
    },
    readPixels(bitmap) {
      return {
        width: bitmap.width,
        height: bitmap.height,
        data: new Uint8ClampedArray(bitmap.width * bitmap.height * 4).fill(128),
      }
    },
    async encodeJpeg(p) {
      return fakeJpeg(p.width, p.height)
    },
    raster: { async createBitmap(p) { return track(fakeBitmap(p.width, p.height)) } },
  }
}

/** Minimal JPEG (SOI, JFIF APP0, SOF0 with dimensions, EOI): enough for jsPDF, which only reads the header. */
export function fakeJpeg(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255,
    0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xd9,
  ])
}
