export interface Point {
  x: number
  y: number
}

/** Corners in order TL, TR, BR, BL, in px of the EXIF-oriented source, before rotating. */
export type Quad = [Point, Point, Point, Point]

/** Clockwise rotation in degrees. */
export type Rotation = 0 | 90 | 180 | 270

/** Structural RGBA image, compatible with ImageData (which does not exist in Node). */
export interface PixelImage {
  width: number
  height: number
  data: Uint8ClampedArray
}
