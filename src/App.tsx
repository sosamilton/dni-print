import { strings } from './ui/strings.es.ts'
import { useWizardNavigation } from './ui/use-wizard-navigation.ts'
import { WizardLayout } from './ui/wizard-layout.tsx'
import { StepBody } from './ui/wizard-screens.tsx'
import { primaryAction, stepNumber } from './ui/wizard-steps.ts'

export function App() {
  const { step, forward, back, restart } = useWizardNavigation()
  const copy = strings.steps[step]

  return (
    <WizardLayout
      stepNumber={stepNumber(step)}
      title={copy.title}
      onBack={step === 'load' ? undefined : back}
      primaryLabel={copy.primary}
      onPrimary={primaryAction(step) === 'restart' ? restart : forward}
    >
      <StepBody step={step} />
    </WizardLayout>
  )
}
