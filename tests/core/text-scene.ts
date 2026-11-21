// Synthetic "document" scenes with simulated text (high-contrast bars and blocks), never real photos.
import type { PixelImage } from '../../src/core/index.ts'

/** Light card with dark text-like bars and a photo-like block; deterministic. */
export function textScene(width: number, height: number): PixelImage {
  const data = new Uint8ClampedArray(width * height * 4)
  const unit = Math.max(2, Math.round(width / 200))
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let v = 225
      // Photo-like block on the left third.
      if (x > width * 0.05 && x < width * 0.3 && y > height * 0.2 && y < height * 0.8) {
        v = ((Math.floor(x / (unit * 3)) + Math.floor(y / (unit * 3))) % 2) ? 60 : 160
      } else if (x > width * 0.35 && x < width * 0.95) {
        // Text lines: rows of short bars ("letters") separated by gaps.
        const line = Math.floor(y / (unit * 6))
        const inLine = y % (unit * 6) < unit * 3
        const letter = Math.floor(x / unit)
        if (inLine && (letter * 7 + line * 3) % 5 < 3) v = 25
      }
      const i = (y * width + x) * 4
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      data[i + 3] = 255
    }
  }
  return { width, height, data }
}

/** Separable box blur of `radius` px, applied `passes` times (returns a new image). */
export function blurScene(img: PixelImage, radius: number, passes: number): PixelImage {
  const { width: w, height: h } = img
  let src = new Float64Array(img.data)
  for (let p = 0; p < passes; p++) {
    for (const horizontal of [true, false]) {
      const out = new Float64Array(src.length)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          for (let c = 0; c < 4; c++) {
            let sum = 0
            let n = 0
            for (let t = -radius; t <= radius; t++) {
              const xx = horizontal ? x + t : x
              const yy = horizontal ? y : y + t
              if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
              sum += src[(yy * w + xx) * 4 + c]!
              n++
            }
            out[(y * w + x) * 4 + c] = sum / n
          }
        }
      }
      src = out
    }
  }
  return { width: w, height: h, data: Uint8ClampedArray.from(src) }
}
