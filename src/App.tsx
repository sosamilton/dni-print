import { useState } from 'react'
import { validateQuad } from './core/index.ts'
import { canContinue } from './ui/load-step-model.ts'
import { useSession } from './ui/session-store.ts'
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
  const copy = strings.steps[step]

  const cropQuad = faces[cropFace]?.quad
  const primaryDisabled =
    (step === 'load' && !canContinue(faces)) || (step === 'crop' && !(cropQuad && validateQuad(cropQuad)))

  function onPrimary() {
    if (primaryAction(step) === 'restart') restart()
    else if (step === 'crop' && cropFace === 'front') setCropFace('back')
    else {
      if (step === 'load') setCropFace('front') // step 2 always starts on the front
      forward()
    }
  }

  return (
    <WizardLayout
      stepNumber={stepNumber(step)}
      title={copy.title}
      onBack={step === 'load' ? undefined : back}
      primaryLabel={copy.primary}
      primaryDisabled={primaryDisabled}
      onPrimary={onPrimary}
    >
      <StepBody step={step} cropFace={cropFace} />
    </WizardLayout>
  )
}
