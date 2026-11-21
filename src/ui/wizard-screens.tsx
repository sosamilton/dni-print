import { createElement } from 'react'
import { CropStep } from './crop-step.tsx'
import { DoneStep } from './done-step.tsx'
import { LoadStep } from './load-step.tsx'
import { PrintStep } from './print-step.tsx'
import { strings } from './strings.es.ts'
import type { StepId } from './wizard-steps.ts'
import type { FaceId } from '../worker/api.ts'

export interface StepBodyProps {
  step: StepId
  /** Face being reviewed in step 2. */
  cropFace: FaceId
  printError?: boolean
}

const LOAD = <LoadStep />

/** Every step has a real screen. */
export function StepBody({ step, cropFace, printError = false }: StepBodyProps) {
  const placeholder = <p>{strings.steps[step].body}</p>
  if (step === 'load') return LOAD
  if (step === 'crop') return createElement(CropStep, { faceId: cropFace })
  if (step === 'print') return createElement(PrintStep, { error: printError })
  if (step === 'done') return createElement(DoneStep)
  return placeholder
}
