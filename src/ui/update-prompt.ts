import { pipeline } from './pipeline.ts'

/** Holds the "new version available" state; applying it clears the session first, then reloads. */
export interface UpdatePrompt {
  getSnapshot(): boolean
  subscribe(listener: () => void): () => void
  /** Called by the SW registration when a new version is waiting. */
  notify(apply: () => Promise<void> | void): void
  /** Clears the session, then applies the update; keeps the notice if applying fails. */
  update(): Promise<void>
}

export function createUpdatePrompt({ clearSession }: { clearSession: () => void }): UpdatePrompt {
  let apply: (() => Promise<void> | void) | null = null
  let busy = false
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((l) => l())
  return {
    getSnapshot: () => apply !== null,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    notify(fn) {
      if (busy) return // an update is in flight: don't swap its callback
      apply = fn
      emit()
    },
    async update() {
      const fn = apply
      if (!fn || busy) return
      busy = true
      try {
        clearSession()
        await fn()
        apply = null
        emit()
      } catch {
        // Applying failed: keep the notice so the user can retry.
      } finally {
        busy = false
      }
    },
  }
}

export const updatePrompt = createUpdatePrompt({ clearSession: () => pipeline.clearSession() })
