import { A4_HEIGHT_MM, A4_WIDTH_MM } from '../core/index.ts'
import type { BitmapLike, LayoutResult } from '../core/index.ts'
import { BitmapCanvas } from './bitmap-canvas.tsx'
import { strings } from './strings.es.ts'

type Sheet = Extract<LayoutResult, { ok: true }>
interface RenderedFaces {
  front: BitmapLike | null
  back: BitmapLike | null
}

function Placeholder({ p }: { p: Sheet['placements'][number] }) {
  return (
    <>
      <rect x={p.xMm} y={p.yMm} width={p.widthMm} height={p.heightMm} fill="#e8eef7" stroke="#4a6fa5" strokeWidth={0.4} />
      <text x={p.xMm + p.widthMm / 2} y={p.yMm + p.heightMm / 2} fontSize={5} textAnchor="middle" fill="#4a6fa5">
        {strings.loadStep.faces[p.face]}
      </text>
    </>
  )
}

/**
 * A4 preview drawn from the same `layout` result that goes to `buildPdf`. Always white.
 * `rendered` is the (already filtered) `renderFace` output per face; a placeholder shows while it is missing.
 */
export function SheetPreview({
  sheet,
  rendered,
  marginMm,
  label = strings.printStep.previewLabel,
}: {
  sheet: Sheet
  rendered?: RenderedFaces
  marginMm: number
  label?: string
}) {
  const { placements, ruler } = sheet
  return (
    <svg
      className="sheet-preview"
      viewBox={`0 0 ${A4_WIDTH_MM} ${A4_HEIGHT_MM}`}
      role="img"
      aria-label={label}
    >
      <rect width={A4_WIDTH_MM} height={A4_HEIGHT_MM} fill="#ffffff" />
      <rect
        x={marginMm}
        y={marginMm}
        width={A4_WIDTH_MM - 2 * marginMm}
        height={A4_HEIGHT_MM - 2 * marginMm}
        fill="none"
        stroke="#b0b8c4"
        strokeWidth={0.3}
        strokeDasharray="2 2"
      />
      {placements.map((p) => {
        const bitmap = rendered?.[p.face]
        return (
          <g key={`${p.copy}-${p.face}`} data-testid="placement">
            {bitmap && (
              <foreignObject x={p.xMm} y={p.yMm} width={p.widthMm} height={p.heightMm}>
                <BitmapCanvas bitmap={bitmap} label={strings.loadStep.faces[p.face]} className="sheet-preview-face" />
              </foreignObject>
            )}
            {!bitmap && <Placeholder p={p} />}
          </g>
        )
      })}
      <line x1={ruler.xMm} x2={ruler.xMm + ruler.lengthMm} y1={ruler.yMm} y2={ruler.yMm} stroke="#000000" strokeWidth={0.4} />
      <line x1={ruler.xMm} x2={ruler.xMm} y1={ruler.yMm - 2} y2={ruler.yMm + 2} stroke="#000000" strokeWidth={0.4} />
      <line x1={ruler.xMm + ruler.lengthMm} x2={ruler.xMm + ruler.lengthMm} y1={ruler.yMm - 2} y2={ruler.yMm + 2} stroke="#000000" strokeWidth={0.4} />
      <text x={ruler.xMm + ruler.lengthMm / 2} y={ruler.yMm - 3} fontSize={4} textAnchor="middle" fill="#000000">
        {strings.printStep.rulerLabel}
      </text>
    </svg>
  )
}
