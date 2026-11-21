import { canContinue } from './ui/load-step-model.ts'
import { useSession } from './ui/session-store.ts'
import { strings } from './ui/strings.es.ts'
import { useWizardNavigation } from './ui/use-wizard-navigation.ts'
import { WizardLayout } from './ui/wizard-layout.tsx'
import { StepBody } from './ui/wizard-screens.tsx'
import { primaryAction, stepNumber } from './ui/wizard-steps.ts'

export function App() {
  const { step, forward, back, restart } = useWizardNavigation()
  const faces = useSession((s) => s.faces)
  const copy = strings.steps[step]

  return (
    <WizardLayout
      stepNumber={stepNumber(step)}
      title={copy.title}
      onBack={step === 'load' ? undefined : back}
      primaryLabel={copy.primary}
      primaryDisabled={step === 'load' && !canContinue(faces)}
      onPrimary={primaryAction(step) === 'restart' ? restart : forward}
    >
      <StepBody step={step} />
    </WizardLayout>
  )
}
