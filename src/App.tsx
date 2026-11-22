import { useCallback, useRef, useState } from 'react'
import { validateQuad } from './core/index.ts'
import { pipeline } from './ui/pipeline.ts'
import { sheetLayout } from './ui/print-step-model.ts'
import { canContinue } from './ui/load-step-model.ts'
import { useSession } from './ui/session-store.ts'
import { useWideLayout } from './ui/use-wide-layout.ts'
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
  const [cleared, setCleared] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const primaryRef = useRef(null as HTMLButtonElement | null)
  const wide = useWideLayout()
  const copies = useSession((s) => s.copies)
  const profileId = useSession((s) => s.profileId)
  const marginMm = useSession((s) => s.marginMm)
  const sheetFits = sheetLayout(profileId, copies, marginMm).ok
  const copy = strings.steps[step]
  const output = primaryAction(step) === 'output'

  const cropQuad = faces[cropFace]?.quad
  const primaryDisabled =
    (step === 'load' && !canContinue(faces)) || (step === 'crop' && !(cropQuad && validateQuad(cropQuad))) || (output && !sheetFits)

  const startOver = useCallback(() => {
    setSheetOpen(false)
    pipeline.clearSession()
    setCleared(true)
    restart()
  }, [restart])

  const closeSheet = useCallback(() => setSheetOpen(false), [])

  function onPrimary() {
    if (output) setSheetOpen(true)
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
      onBack={step === 'load' ? undefined : back}
      // From 900px step 3 has no «Está bien»: the output panel is always visible.
      primaryLabel={output && wide ? undefined : copy.primary}
      primaryDisabled={primaryDisabled}
      primaryRef={primaryRef}
      primaryOpensDialog={output}
      onRestart={startOver}
      onPrimary={onPrimary}
    >
      {step === 'load' && cleared && !faces.front && !faces.back && (
        <p role="status">{strings.output.cleared}</p>
      )}
      <StepBody
        step={step}
        cropFace={cropFace}
        output={{ sheetOpen, onSheetClose: closeSheet, returnFocusRef: primaryRef, onRestart: startOver }}
      />
    </WizardLayout>
  )
}
