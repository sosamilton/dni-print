import { useRef, useState } from 'react'
import { validateQuad } from './core/index.ts'
import { pipeline } from './ui/pipeline.ts'
import { sheetLayout } from './ui/print-step-model.ts'
import { canContinue } from './ui/load-step-model.ts'
import { sessionStore, useSession } from './ui/session-store.ts'
import { pdfFileName } from './ui/share-pdf.ts'
import { strings } from './ui/strings.es.ts'
import { useWizardNavigation } from './ui/use-wizard-navigation.ts'
import { WizardLayout } from './ui/wizard-layout.tsx'
import { StepBody } from './ui/wizard-screens.tsx'
import { primaryAction, stepNumber } from './ui/wizard-steps.ts'
import type { FaceId } from './worker/api.ts'

export function App() {
  const { step, forward, back, restart } = useWizardNavigation()
  const faces = useSession((s) => s.faces)
  const [cropFace, setCropFace] = useState<FaceId>('front')
  const [preparing, setPreparing] = useState(false)
  const [printError, setPrintError] = useState(false)
  const [cleared, setCleared] = useState(false)
  const downloadRun = useRef(0) // invalidated by startOver/back so a late PDF is dropped
  const copies = useSession((s) => s.copies)
  const profileId = useSession((s) => s.profileId)
  const marginMm = useSession((s) => s.marginMm)
  const sheetFits = sheetLayout(profileId, copies, marginMm).ok
  const copy = strings.steps[step]

  const cropQuad = faces[cropFace]?.quad
  const primaryDisabled =
    (step === 'load' && !canContinue(faces)) || (step === 'crop' && !(cropQuad && validateQuad(cropQuad)))

  function startOver() {
    downloadRun.current++
    setPreparing(false)
    pipeline.clearSession()
    setCleared(true)
    restart()
  }

  async function download() {
    if (preparing) return
    const run = ++downloadRun.current
    setPreparing(true)
    setPrintError(false)
    const result = await pipeline.buildPdf(copies)
    if (run !== downloadRun.current) return // the session was cleared meanwhile
    setPreparing(false)
    if (!result.ok) {
      setPrintError(true)
      return
    }
    const store = sessionStore.getState()
    store.setPdf(result.pdf, copies)
    const url = store.createPdfUrl(result.pdf)
    const link = document.createElement('a')
    link.href = url
    link.download = pdfFileName(copies)
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => sessionStore.getState().releaseUrl(url), 10_000)
    forward()
  }

  function onPrimary() {
    if (step === 'print') void download()
    else if (primaryAction(step) === 'restart') startOver()
    else if (step === 'crop' && cropFace === 'front') setCropFace('back')
    else {
      setCleared(false)
      if (step === 'load') setCropFace('front') // step 2 always starts on the front
      forward()
    }
  }

  return (
    <WizardLayout
      stepNumber={stepNumber(step)}
      title={copy.title}
      onBack={step === 'load' || preparing ? undefined : back}
      primaryLabel={step === 'print' && preparing ? strings.printStep.preparing : copy.primary}
      primaryDisabled={primaryDisabled || (step === 'print' && (preparing || !sheetFits))}
      onRestart={startOver}
      onPrimary={onPrimary}
    >
      {step === 'load' && cleared && !faces.front && !faces.back && (
        <p role="status">{strings.doneStep.cleared}</p>
      )}
      <StepBody step={step} cropFace={cropFace} printError={printError} />
    </WizardLayout>
  )
}
