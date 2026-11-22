import { pipeline } from './pipeline.ts'
import { FACE_FILTERS, MAX_WATERMARK_CHARS, normalizeWatermark } from '../core/index.ts'
import { maxMarginMm, MIN_MARGIN_MM, previewDescription, sheetLayout } from './print-step-model.ts'
import { OutputPanel, type OutputPanelProps } from './output-panel.tsx'
import { SheetPreview } from './sheet-preview.tsx'
import { sessionStore, useSession } from './session-store.ts'
import { strings } from './strings.es.ts'
import './print-step.css'

const OPTIONS = [1, 2] as const

/** Step 3 «Revisá la hoja»: preview and settings, plus the output panel (or bottom sheet below 900px). */
export function PrintStep({ output }: { output: OutputPanelProps }) {
  const copies = useSession((s) => s.copies)
  const profileId = useSession((s) => s.profileId)
  const filter = useSession((s) => s.filter)
  const watermarkOn = useSession((s) => s.watermarkOn)
  const watermarkText = useSession((s) => s.watermarkText)
  const faces = useSession((s) => s.faces)
  const marginMm = useSession((s) => s.marginMm)
  const sheet = sheetLayout(profileId, copies, marginMm)
  const maxMargin = maxMarginMm(profileId, copies)
  const copy = strings.printStep
  return (
    <div className="print-step" data-layout="columns">
      <div className="print-columns">
      <div className="print-main">
      <div className="print-preview">
      {!sheet.ok && (
        <p className="print-error" role="alert">
          {copy.noFit(copies)}
        </p>
      )}
      {sheet.ok && (
        <SheetPreview
          sheet={sheet}
          marginMm={marginMm}
          label={previewDescription(copies, filter, normalizeWatermark(watermarkOn, watermarkText) !== null)}
          rendered={{ front: faces.front?.rendered ?? null, back: faces.back?.rendered ?? null }}
        />
      )}
      </div>
      <div className="print-options">
      <div className="seg" role="group" aria-label={copy.copiesLabel}>
        {OPTIONS.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={copies === n}
            className="seg-option"
            data-selected={copies === n}
            onClick={() => sessionStore.getState().setCopies(n)}
          >
            {copy.copies[n]}
          </button>
        ))}
      </div>
      <div className="seg" role="group" aria-label={copy.filterLabel}>
        {FACE_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            className="seg-option"
            data-selected={filter === f}
            onClick={() => void pipeline.setFilter(f)}
          >
            {copy.filters[f]}
          </button>
        ))}
      </div>
      <label className="print-watermark-toggle">
        <span>{copy.watermarkToggle}</span>
        <input
          type="checkbox"
          role="switch"
          className="switch"
          checked={watermarkOn}
          onChange={(e) => void pipeline.setWatermarkOn(e.target.checked)}
        />
      </label>
      {watermarkOn && (
        <input
          type="text"
          className="print-watermark-field"
          aria-label={copy.watermarkField}
          placeholder={copy.watermarkPlaceholder}
          maxLength={MAX_WATERMARK_CHARS}
          value={watermarkText}
          onChange={(e) => void pipeline.setWatermarkText(e.target.value)}
        />
      )}
      <details className="print-more">
        <summary>{copy.moreOptions}</summary>
        <label className="print-margin">
          {copy.marginLabel}: <output>{copy.marginValue(marginMm)}</output>
          <input
            type="range"
            min={MIN_MARGIN_MM}
            max={maxMargin}
            step={1}
            value={Math.min(marginMm, maxMargin)}
            aria-valuetext={copy.marginValue(marginMm)}
            onChange={(e) => sessionStore.getState().setMarginMm(Number(e.target.value))}
          />
        </label>
      </details>
      <p className="print-notice hint">{copy.notice}</p>
      </div>
      </div>
      <OutputPanel {...output} />
      </div>
    </div>
  )
}
