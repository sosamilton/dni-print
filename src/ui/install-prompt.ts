/** Captures `beforeinstallprompt` so the ⋮ menu can offer "Instalar la app" (only where the browser supports it). */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface InstallPrompt {
  getSnapshot(): boolean
  subscribe(listener: () => void): () => void
  /** Shows the browser's install dialog; false when not installable. */
  install(): Promise<boolean>
}

export function createInstallPrompt(target: EventTarget, isStandalone: () => boolean = () => false): InstallPrompt {
  let deferred: BeforeInstallPromptEvent | null = null
  let installed = isStandalone()
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((l) => l())
  target.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event as BeforeInstallPromptEvent
    emit()
  })
  target.addEventListener('appinstalled', () => {
    installed = true
    deferred = null
    emit()
  })
  return {
    getSnapshot: () => deferred !== null && !installed,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async install() {
      const event = deferred
      if (!event || installed) return false
      deferred = null
      emit()
      try {
        await event.prompt()
        const choice = await event.userChoice
        if (choice?.outcome === 'accepted') return true
      } catch {
        // prompt() failed: fall through and keep the option available.
      }
      // Dismissed or failed: the event can be reused only if the browser allows it; keep the option visible.
      if (!installed) {
        deferred = event
        emit()
      }
      return false
    },
  }
}

const standalone = () =>
  typeof matchMedia === 'function' && (matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true)

export const installPrompt = createInstallPrompt(typeof window === 'undefined' ? new EventTarget() : window, standalone)
