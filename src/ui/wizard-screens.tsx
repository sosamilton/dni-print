import { strings } from './strings.es.ts'
import type { StepId } from './wizard-steps.ts'

export interface StepBodyProps {
  step: StepId
}

/** Placeholder content for each step; the real screens arrive in Epic 2. */
export function StepBody({ step }: StepBodyProps) {
  return <p>{strings.steps[step].body}</p>
}
