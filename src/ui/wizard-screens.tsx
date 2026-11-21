import { LoadStep } from './load-step.tsx'
import { strings } from './strings.es.ts'
import type { StepId } from './wizard-steps.ts'

export interface StepBodyProps {
  step: StepId
}

const LOAD = <LoadStep />

/** Step 1 is the real load screen; the others stay placeholders until their stories. */
export function StepBody({ step }: StepBodyProps) {
  const placeholder = <p>{strings.steps[step].body}</p>
  return step === 'load' ? LOAD : placeholder
}
