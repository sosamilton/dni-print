import { useEffect, useRef } from 'react'
import type { BitmapLike } from '../core/index.ts'

export interface BitmapCanvasProps {
  bitmap: BitmapLike
  label: string
  className?: string
}

/** Draws a bitmap on a canvas (no blob URLs, nothing stored). */
export function BitmapCanvas({ bitmap, label, className }: BitmapCanvasProps) {
  const ref = useRef(null as HTMLCanvasElement | null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    try {
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      ctx.drawImage(bitmap as unknown as CanvasImageSource, 0, 0)
    } catch {
      // Bitmap already closed (session cleared); nothing to draw.
    }
  }, [bitmap])
  return <canvas ref={ref} className={className} role="img" aria-label={label} />
}
