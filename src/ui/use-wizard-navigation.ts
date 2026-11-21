import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createStepHistory } from './step-history.ts'
import { stepIndex, type StepId } from './wizard-steps.ts'

export interface WizardNavigation {
  step: StepId
  forward(): void
  back(): void
  restart(): void
}

export function useWizardNavigation(): WizardNavigation {
  const stepHistory = useMemo(() => createStepHistory(window.history), [])
  const [step, setStep] = useState<StepId>('load')
  // True between back()/restart() and the popstate that ends the traversal,
  // so a double click cannot step out of the app.
  const traversalPending = useRef(false)

  useEffect(() => {
    // The initial state is already 'load', the step start() always lands on.
    stepHistory.start()
    const onPopState = (event: PopStateEvent) => {
      traversalPending.current = false
      setStep(stepHistory.fromPopState(event.state))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [stepHistory])

  const forward = useCallback(() => setStep(stepHistory.forward(step)), [stepHistory, step])
  const back = useCallback(() => {
    if (traversalPending.current) return
    traversalPending.current = true
    stepHistory.back()
  }, [stepHistory])
  const restart = useCallback(() => {
    if (traversalPending.current || stepIndex(step) === 0) return
    traversalPending.current = true
    stepHistory.restart(step)
  }, [stepHistory, step])

  return { step, forward, back, restart }
}
