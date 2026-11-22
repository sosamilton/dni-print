import { createElement } from 'react'
import { CropStep } from './crop-step.tsx'
import { LoadStep } from './load-step.tsx'
import type { OutputPanelProps } from './output-panel.tsx'
import { PrintStep } from './print-step.tsx'
import type { StepId } from './wizard-steps.ts'
import type { FaceId } from '../worker/api.ts'

export interface StepBodyProps {
  step: StepId
  /** Face being reviewed in step 2. */
  cropFace: FaceId
  /** Step 3's output panel / bottom sheet. */
  output: OutputPanelProps
}

const LOAD = <LoadStep />

/** Every step has a real screen. */
export function StepBody({ step, cropFace, output }: StepBodyProps) {
  if (step === 'load') return LOAD
  if (step === 'crop') return createElement(CropStep, { faceId: cropFace, key: cropFace })
  return createElement(PrintStep, { output })
}
