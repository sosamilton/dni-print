import { A4_HEIGHT_MM, A4_WIDTH_MM } from '../core/index.ts'
import type { LayoutResult } from '../core/index.ts'
import { SHEET_MARGIN_MM } from './print-step-model.ts'
import { strings } from './strings.es.ts'

/** A4 preview drawn from the same `layout` result that goes to `buildPdf`. Always white. */
export function SheetPreview({ sheet }: { sheet: Extract<LayoutResult, { ok: true }> }) {
  const { placements, ruler } = sheet
  return (
    <svg
      className="sheet-preview"
      viewBox={`0 0 ${A4_WIDTH_MM} ${A4_HEIGHT_MM}`}
      role="img"
      aria-label={strings.printStep.previewLabel}
    >
      <rect width={A4_WIDTH_MM} height={A4_HEIGHT_MM} fill="#ffffff" />
      <rect
        x={SHEET_MARGIN_MM}
        y={SHEET_MARGIN_MM}
        width={A4_WIDTH_MM - 2 * SHEET_MARGIN_MM}
        height={A4_HEIGHT_MM - 2 * SHEET_MARGIN_MM}
        fill="none"
        stroke="#b0b8c4"
        strokeWidth={0.3}
        strokeDasharray="2 2"
      />
      {placements.map((p) => (
        <g key={`${p.copy}-${p.face}`} data-testid="placement">
          <rect x={p.xMm} y={p.yMm} width={p.widthMm} height={p.heightMm} fill="#e8eef7" stroke="#4a6fa5" strokeWidth={0.4} />
          <text x={p.xMm + p.widthMm / 2} y={p.yMm + p.heightMm / 2} fontSize={5} textAnchor="middle" fill="#4a6fa5">
            {strings.loadStep.faces[p.face]}
          </text>
        </g>
      ))}
      <line x1={ruler.xMm} x2={ruler.xMm + ruler.lengthMm} y1={ruler.yMm} y2={ruler.yMm} stroke="#000000" strokeWidth={0.4} />
      <line x1={ruler.xMm} x2={ruler.xMm} y1={ruler.yMm - 2} y2={ruler.yMm + 2} stroke="#000000" strokeWidth={0.4} />
      <line x1={ruler.xMm + ruler.lengthMm} x2={ruler.xMm + ruler.lengthMm} y1={ruler.yMm - 2} y2={ruler.yMm + 2} stroke="#000000" strokeWidth={0.4} />
      <text x={ruler.xMm + ruler.lengthMm / 2} y={ruler.yMm - 3} fontSize={4} textAnchor="middle" fill="#000000">
        {strings.printStep.rulerLabel}
      </text>
    </svg>
  )
}
