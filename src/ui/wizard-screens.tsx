import { createElement } from 'react'
import { CropStep } from './crop-step.tsx'
import { LoadStep } from './load-step.tsx'
import { strings } from './strings.es.ts'
import type { StepId } from './wizard-steps.ts'
import type { FaceId } from '../worker/api.ts'

export interface StepBodyProps {
  step: StepId
  /** Face being reviewed in step 2. */
  cropFace: FaceId
}

const LOAD = <LoadStep />

/** Steps 1 and 2 are real screens; the others stay placeholders until their stories. */
export function StepBody({ step, cropFace }: StepBodyProps) {
  const placeholder = <p>{strings.steps[step].body}</p>
  return step === 'load' ? LOAD : step === 'crop' ? createElement(CropStep, { faceId: cropFace }) : placeholder
}
