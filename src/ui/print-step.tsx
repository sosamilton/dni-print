import { sheetLayout } from './print-step-model.ts'
import { SheetPreview } from './sheet-preview.tsx'
import { sessionStore, useSession } from './session-store.ts'
import { strings } from './strings.es.ts'
import './print-step.css'

const OPTIONS = [1, 2] as const

export function PrintStep({ error = false }: { error?: boolean }) {
  const copies = useSession((s) => s.copies)
  const profileId = useSession((s) => s.profileId)
  const sheet = sheetLayout(profileId, copies)
  const copy = strings.printStep
  return (
    <div className="print-step">
      <div className="print-copies" role="group" aria-label={copy.copiesLabel}>
        {OPTIONS.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={copies === n}
            className="print-copies-option"
            data-selected={copies === n}
            onClick={() => sessionStore.getState().setCopies(n)}
          >
            {copy.copies[n]}
          </button>
        ))}
      </div>
      {sheet.ok && <SheetPreview sheet={sheet} />}
      <p className="print-notice">{copy.notice}</p>
      {error && (
        <p className="print-error" role="alert">
          {copy.failed}
        </p>
      )}
    </div>
  )
}
