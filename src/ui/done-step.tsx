import { useMemo, useState } from 'react'
import { currentNavigator, isIos } from './platform.ts'
import { useSession } from './session-store.ts'
import { canSharePdf, currentShareNavigator, pdfFile, sharePdf } from './share-pdf.ts'
import { strings } from './strings.es.ts'
import './print-step.css'

export function DoneStep() {
  const ios = isIos(currentNavigator())
  const pdf = useSession((s) => s.pdf)
  const [shareFailed, setShareFailed] = useState(false)
  const file = useMemo(() => pdfFile(pdf), [pdf])
  const canShare = file !== null && canSharePdf(currentShareNavigator(), file)

  function onShare() {
    if (!file) return
    setShareFailed(false)
    // No await before share(): the call must stay inside the user gesture.
    void sharePdf(currentShareNavigator(), file).then((outcome) => setShareFailed(outcome === 'failed'))
  }

  return (
    <div className="print-step">
      <p className="print-notice">{strings.doneStep.instruction}</p>
      {canShare && (
        <button type="button" className="share-button" onClick={onShare}>
          {strings.doneStep.share}
        </button>
      )}
      {shareFailed && (
        <p className="print-error" role="alert">
          {strings.doneStep.shareFailed}
        </p>
      )}
      {ios && (
        <section className="ios-guide" aria-labelledby="ios-guide-title">
          <h2 id="ios-guide-title" className="ios-guide-title">
            {strings.doneStep.iosGuideTitle}
          </h2>
          <ol>
            {strings.doneStep.iosGuideSteps.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
