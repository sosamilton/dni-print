// Pure wizard step model: no React, no DOM.

export type StepId = 'load' | 'crop' | 'print' | 'done'

export const STEP_ORDER: readonly StepId[] = ['load', 'crop', 'print', 'done']

/** Number of numbered steps shown as "Paso N de 3" (done is not a fourth step). */
export const STEP_COUNT = 3

export function isStepId(value: unknown): value is StepId {
  return typeof value === 'string' && (STEP_ORDER as readonly string[]).includes(value)
}

export function stepIndex(step: StepId): number {
  return STEP_ORDER.indexOf(step)
}

export function nextStep(step: StepId): StepId | null {
  return STEP_ORDER[stepIndex(step) + 1] ?? null
}

export function previousStep(step: StepId): StepId | null {
  const index = stepIndex(step)
  return index > 0 ? STEP_ORDER[index - 1] : null
}

/** 1-based step number for the counter and progress bar; done shows as 3. */
export function stepNumber(step: StepId): number {
  return Math.min(stepIndex(step) + 1, STEP_COUNT)
}

/** The footer's primary action: advance, or start over from the last screen. */
export function primaryAction(step: StepId): 'forward' | 'restart' {
  return nextStep(step) === null ? 'restart' : 'forward'
}

/** Reads a `history.state` value; anything unknown falls back to the first step. */
export function parseHistoryState(state: unknown): StepId {
  if (typeof state === 'object' && state !== null && 'step' in state) {
    const { step } = state as { step: unknown }
    if (isStepId(step)) return step
  }
  return 'load'
}
