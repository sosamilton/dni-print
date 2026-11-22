import { describe, expect, it } from 'vitest'
import { createStepHistory, type StepHistoryApi } from '../../src/ui/step-history.ts'
import {
  nextStep,
  parseHistoryState,
  previousStep,
  primaryAction,
  stepIndex,
  stepNumber,
  STEP_COUNT,
  STEP_ORDER,
} from '../../src/ui/wizard-steps.ts'

/** In-memory History: a stack of states that emits popstate-like callbacks. */
function createFakeHistory(initialState: unknown = null) {
  const entries: unknown[] = [initialState]
  let index = 0
  const popped: unknown[] = []
  const history: StepHistoryApi = {
    get state() {
      return entries[index]
    },
    pushState(state: unknown) {
      entries.splice(index + 1, entries.length, state)
      index = entries.length - 1
    },
    replaceState(state: unknown) {
      entries[index] = state
    },
    back() {
      history.go(-1)
    },
    go(delta = 0) {
      if (delta === 0) throw new Error('go(0) reloads the page')
      const target = index + delta
      if (target < 0 || target >= entries.length) return
      index = target
      popped.push(entries[index])
    },
  }
  return { history, entries, popped, getIndex: () => index }
}

describe('wizard steps', () => {
  it('orders load → crop → print, three steps', () => {
    expect(STEP_ORDER).toEqual(['load', 'crop', 'print'])
    expect(STEP_COUNT).toBe(3)
    expect(STEP_ORDER.map(stepIndex)).toEqual([0, 1, 2])
    expect(STEP_ORDER.map(nextStep)).toEqual(['crop', 'print', null])
    expect(STEP_ORDER.map(previousStep)).toEqual([null, 'load', 'crop'])
  })

  it('numbers steps 1–3', () => {
    expect(STEP_ORDER.map(stepNumber)).toEqual([1, 2, 3])
  })

  it('advances on load and crop; on print «Está bien» opens the output options', () => {
    expect(STEP_ORDER.map(primaryAction)).toEqual(['forward', 'forward', 'output'])
  })

  it('parses valid history states', () => {
    for (const step of STEP_ORDER) expect(parseHistoryState({ step })).toBe(step)
  })

  it('reads invalid history states as load without throwing', () => {
    for (const state of [null, undefined, 42, 'crop', {}, { step: 'nope' }, { step: 3 }, { step: 'done' }, []]) {
      expect(parseHistoryState(state)).toBe('load')
    }
  })
})

describe('step history', () => {
  it('starts on load replacing the current entry (also after a reload on any step)', () => {
    const fake = createFakeHistory({ step: 'print' })
    const nav = createStepHistory(fake.history)
    expect(nav.start()).toBe('load')
    expect(fake.entries).toEqual([{ step: 'load' }])
    expect(fake.history.state).toEqual({ step: 'load' })
  })

  it('pushes the next step on forward, up to print', () => {
    const fake = createFakeHistory()
    const nav = createStepHistory(fake.history)
    let step = nav.start()
    step = nav.forward(step)
    expect(step).toBe('crop')
    step = nav.forward(step)
    expect(step).toBe('print')
    expect(fake.entries).toEqual([{ step: 'load' }, { step: 'crop' }, { step: 'print' }])
    expect(nav.forward('print')).toBe('print')
    expect(fake.entries).toHaveLength(3)
  })

  it('goes back one step via popstate', () => {
    const fake = createFakeHistory()
    const nav = createStepHistory(fake.history)
    nav.forward(nav.forward(nav.start()))
    nav.back()
    expect(nav.fromPopState(fake.popped.at(-1))).toBe('crop')
    nav.back()
    expect(nav.fromPopState(fake.popped.at(-1))).toBe('load')
  })

  it('restarts from print by rewinding the history to load', () => {
    const fake = createFakeHistory()
    const nav = createStepHistory(fake.history)
    const print = nav.forward(nav.forward(nav.start()))
    nav.restart(print)
    expect(fake.getIndex()).toBe(0)
    expect(nav.fromPopState(fake.popped.at(-1))).toBe('load')
  })

  it('does not reload when restarting from load', () => {
    const fake = createFakeHistory()
    const nav = createStepHistory(fake.history)
    expect(() => nav.restart(nav.start())).not.toThrow()
    expect(fake.popped).toEqual([])
  })

  it('maps unknown popstate states to load', () => {
    const nav = createStepHistory(createFakeHistory().history)
    expect(nav.fromPopState(null)).toBe('load')
    expect(nav.fromPopState({ step: 'menu' })).toBe('load')
  })
})
