// Wizard navigation over the browser history, without React.
import { nextStep, parseHistoryState, stepIndex, type StepId } from './wizard-steps.ts'

/**
 * The slice of `History` this module uses (`Pick<History, 'state' | 'pushState' |
 * 'replaceState' | 'back' | 'go'>`), spelled out so node-typed tests can use it.
 */
export interface StepHistoryApi {
  readonly state: unknown
  pushState(data: unknown, unused: string, url?: string | URL | null): void
  replaceState(data: unknown, unused: string, url?: string | URL | null): void
  back(): void
  go(delta?: number): void
}

export interface StepHistory {
  /** Replaces the current entry with the first step (also after a reload). */
  start(): StepId
  /** Pushes the step after `current` and returns it (`current` if it is the last). */
  forward(current: StepId): StepId
  /** Goes back one entry; the step arrives via `popstate`. */
  back(): void
  /** Rewinds the history to the first step; the step arrives via `popstate`. */
  restart(current: StepId): void
  /** Step to show for a `popstate` event's state. */
  fromPopState(state: unknown): StepId
}

export function createStepHistory(history: StepHistoryApi): StepHistory {
  return {
    start() {
      history.replaceState({ step: 'load' }, '')
      return 'load'
    },
    forward(current) {
      const next = nextStep(current)
      if (next === null) return current
      history.pushState({ step: next }, '')
      return next
    },
    back() {
      history.back()
    },
    restart(current) {
      const index = stepIndex(current)
      // go(0) would reload the page.
      if (index > 0) history.go(-index)
    },
    fromPopState(state) {
      return parseHistoryState(state)
    },
  }
}
