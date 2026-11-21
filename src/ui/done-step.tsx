import { strings } from './strings.es.ts'
import './print-step.css'

export function DoneStep() {
  return (
    <div className="print-step">
      <p className="print-notice">{strings.doneStep.instruction}</p>
    </div>
  )
}
