import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { validateQuad } from '../core/index.ts'
import type { Quad } from '../core/index.ts'
import type { FaceState } from './session-store.ts'
import { BitmapCanvas } from './bitmap-canvas.tsx'
import {
  MAGNIFIER_SIZE_PX,
  MAGNIFIER_ZOOM,
  adjacentCorners,
  clampPoint,
  keyDelta,
  magnifierSide,
  magnifierWindow,
  screenToSource,
  toMagnifier,
  withCorner,
} from './corner-editor-model.ts'
import { strings } from './strings.es.ts'
import './corner-editor.css'

export interface CornerEditorProps {
  face: Pick<FaceState, 'sourceSize' | 'previewBitmap' | 'quad'>
  /** Emits the quad in source px (EXIF-oriented, before rotating). */
  onCommit: (quad: Quad) => void
}

function readNumber(style: CSSStyleDeclaration, name: string, fallback: number): number {
  const value = parseFloat(style.getPropertyValue(name))
  return value > 0 ? value : fallback
}

function Magnifier({
  face,
  quad,
  index,
  displayedWidth,
}: {
  face: CornerEditorProps['face']
  quad: Quad
  index: number
  /** Width of the image on screen (CSS px). */
  displayedWidth: number
}) {
  const ref = useRef(null as HTMLCanvasElement | null)
  const point = quad[index]
  const [a, b] = adjacentCorners(quad, index)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const style = getComputedStyle(canvas)
    const size = readNumber(style, '--magnifier-size', MAGNIFIER_SIZE_PX)
    const zoom = readNumber(style, '--magnifier-zoom', MAGNIFIER_ZOOM)
    const dpr = window.devicePixelRatio || 1
    const buffer = Math.round(size * dpr)
    if (canvas.width !== buffer) canvas.width = buffer
    if (canvas.height !== buffer) canvas.height = buffer
    // Scale by the rounded buffer, not raw dpr, so fractional ratios map exactly.
    const scale = buffer / size
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    ctx.clearRect(0, 0, size, size)
    const { sourceSize, previewBitmap } = face
    const previewSize = { width: previewBitmap.width, height: previewBitmap.height }
    const win = magnifierWindow(point, sourceSize, previewSize, displayedWidth, size, zoom)
    if (win) {
      try {
        ctx.drawImage(
          previewBitmap as unknown as CanvasImageSource,
          win.sx,
          win.sy,
          win.sw,
          win.sh,
          win.dx,
          win.dy,
          win.dw,
          win.dh,
        )
      } catch {
        // Bitmap closed; nothing to magnify.
      }
    }
    const lineWidth = readNumber(style, '--corner-line-width', 2)
    ctx.lineWidth = lineWidth
    ctx.strokeStyle = style.getPropertyValue('--color-accent').trim() || 'blue'
    ctx.beginPath()
    for (const neighbour of [a, b]) {
      const to = toMagnifier(neighbour, point, sourceSize, previewSize, displayedWidth, size, zoom)
      if (!to) continue
      ctx.moveTo(size / 2, size / 2)
      ctx.lineTo(to.x, to.y)
    }
    ctx.stroke()
    ctx.lineWidth = lineWidth / 2
    ctx.strokeStyle = style.getPropertyValue('--color-danger').trim() || 'red'
    ctx.beginPath()
    ctx.moveTo(size / 2, 0)
    ctx.lineTo(size / 2, size)
    ctx.moveTo(0, size / 2)
    ctx.lineTo(size, size / 2)
    ctx.stroke()
  }, [face, point, a, b, displayedWidth])
  const side = magnifierSide(point, face.sourceSize)
  return (
    <canvas
      ref={ref}
      className="corner-magnifier"
      data-side={side.x}
      data-vside={side.y}
      role="img"
      aria-label={strings.cropStep.magnifierLabel}
    />
  )
}

export function CornerEditor({ face, onCommit }: CornerEditorProps) {
  const { sourceSize } = face
  const wrapRef = useRef(null as HTMLDivElement | null)
  const [draft, setDraft] = useState(null as Quad | null)
  const [dragging, setDragging] = useState(null as number | null)
  const [displayedWidth, setDisplayedWidth] = useState(0)
  const quad = draft ?? face.quad
  const valid = validateQuad(quad)

  function sourcePoint(event: PointerEvent) {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return null
    return screenToSource(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      { width: rect.width, height: rect.height },
      sourceSize,
    )
  }

  function onPointerDown(index: number, event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    event.currentTarget.focus()
    setDisplayedWidth(wrapRef.current?.getBoundingClientRect().width ?? 0)
    setDragging(index)
    setDraft(face.quad)
  }

  function onPointerMove(index: number, event: PointerEvent) {
    if (dragging !== index) return
    const point = sourcePoint(event)
    if (point) setDraft((current) => withCorner(current ?? face.quad, index, point))
  }

  function endDrag(index: number, event: PointerEvent) {
    if (dragging !== index) return
    const point = sourcePoint(event)
    const final = point ? withCorner(draft ?? face.quad, index, point) : (draft ?? face.quad)
    setDragging(null)
    setDraft(null)
    onCommit(final)
  }

  function onKeyDown(index: number, event: KeyboardEvent) {
    const delta = keyDelta(event.key, event.shiftKey)
    if (!delta) return
    event.preventDefault()
    const p = face.quad[index]
    onCommit(
      withCorner(
        face.quad,
        index,
        clampPoint({ x: p.x + delta.x, y: p.y + delta.y }, sourceSize.widthPx, sourceSize.heightPx),
      ),
    )
  }

  const points = quad.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <div className="corner-editor" data-valid={valid} data-testid="corner-editor">
      <div className="corner-stage" ref={wrapRef}>
        <BitmapCanvas bitmap={face.previewBitmap} label={strings.cropStep.editorLabel} className="corner-image" />
        <svg
          className="corner-outline"
          viewBox={`0 0 ${sourceSize.widthPx} ${sourceSize.heightPx}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polygon points={points} vectorEffect="non-scaling-stroke" data-valid={valid} />
        </svg>
        {quad.map((p, index) => (
          <button
            key={index}
            type="button"
            className="corner-handle"
            data-dragging={dragging === index}
            data-testid={`corner-${index}`}
            aria-label={strings.cropStep.corners[index]}
            style={{ left: `${(p.x / sourceSize.widthPx) * 100}%`, top: `${(p.y / sourceSize.heightPx) * 100}%` }}
            onPointerDown={(e) => onPointerDown(index, e)}
            onPointerMove={(e) => onPointerMove(index, e)}
            onPointerUp={(e) => endDrag(index, e)}
            onPointerCancel={(e) => endDrag(index, e)}
            onKeyDown={(e) => onKeyDown(index, e)}
          >
            <span className="corner-dot" />
          </button>
        ))}
        {dragging !== null && <Magnifier face={face} quad={quad} index={dragging} displayedWidth={displayedWidth} />}
      </div>
    </div>
  )
}
