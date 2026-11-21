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
    raster: { async createBitmap(p) { return track(fakeBitmap(p.width, p.height)) } },
  }
}
