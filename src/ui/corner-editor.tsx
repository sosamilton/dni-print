import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { validateQuad } from '../core/index.ts'
import type { Quad } from '../core/index.ts'
import type { FaceState } from './session-store.ts'
import { BitmapCanvas } from './bitmap-canvas.tsx'
import { clampPoint, keyDelta, screenToSource, withCorner } from './corner-editor-model.ts'
import { strings } from './strings.es.ts'
import './corner-editor.css'

const MAGNIFIER_PX = 96
const MAGNIFIER_SPAN_PX = 40 // source px shown in the magnifier

export interface CornerEditorProps {
  face: Pick<FaceState, 'sourceSize' | 'previewBitmap' | 'quad'>
  /** Emits the quad in source px (EXIF-oriented, before rotating). */
  onCommit: (quad: Quad) => void
}

function Magnifier({ face, quad, index }: { face: CornerEditorProps['face']; quad: Quad; index: number }) {
  const ref = useRef(null as HTMLCanvasElement | null)
  const point = quad[index]
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const scale = face.previewBitmap.width / face.sourceSize.widthPx
    const span = MAGNIFIER_SPAN_PX * scale
    ctx.clearRect(0, 0, MAGNIFIER_PX, MAGNIFIER_PX)
    try {
      ctx.drawImage(
        face.previewBitmap as unknown as CanvasImageSource,
        point.x * scale - span / 2,
        point.y * scale - span / 2,
        span,
        span,
        0,
        0,
        MAGNIFIER_PX,
        MAGNIFIER_PX,
      )
    } catch {
      // Bitmap closed; nothing to magnify.
    }
    ctx.strokeStyle = '#d33'
    ctx.beginPath()
    ctx.moveTo(MAGNIFIER_PX / 2, 0)
    ctx.lineTo(MAGNIFIER_PX / 2, MAGNIFIER_PX)
    ctx.moveTo(0, MAGNIFIER_PX / 2)
    ctx.lineTo(MAGNIFIER_PX, MAGNIFIER_PX / 2)
    ctx.stroke()
  }, [face, point.x, point.y])
  const side = point.x < face.sourceSize.widthPx / 2 ? 'right' : 'left'
  return (
    <canvas
      ref={ref}
      className="corner-magnifier"
      data-side={side}
      width={MAGNIFIER_PX}
      height={MAGNIFIER_PX}
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
        {dragging !== null && <Magnifier face={face} quad={quad} index={dragging} />}
      </div>
    </div>
  )
}
