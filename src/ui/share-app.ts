// Compartir la app (no el PDF): puro, el navegador se inyecta. Solo viaja la URL canónica, nunca datos de la sesión.
import { strings } from './strings.es.ts'

export interface ShareAppNavigator {
  share?: (data: { title: string; text: string; url: string }) => Promise<void>
  clipboard?: { writeText?: (text: string) => Promise<void> }
}

export type ShareAppOutcome = 'shared' | 'cancelled' | 'copied' | 'failed'

/** URL canónica de la build; sin sitio conocido, la de la página sin query ni hash. */
export function appShareUrl(siteUrl: string | null, location: { origin: string }, base: string): string {
  return siteUrl ?? new URL(base, location.origin).href
}

/** Enlace de WhatsApp con el texto y la URL; navegación iniciada por el usuario. */
export function appWhatsappLink(url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${strings.shareApp.text} ${url}`)}`
}

/**
 * Con Web Share abre el menú del sistema; si no existe, copia el enlace. Llama a `share` sin
 * await previo (conserva el gesto). Nunca rechaza.
 */
export function shareApp(nav: ShareAppNavigator, url: string): Promise<ShareAppOutcome> {
  const data = { title: strings.shareApp.title, text: strings.shareApp.text, url }
  try {
    if (typeof nav.share === 'function') {
      return Promise.resolve(nav.share(data)).then(
        (): ShareAppOutcome => 'shared',
        (err: unknown): ShareAppOutcome =>
          typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError' ? 'cancelled' : 'failed',
      )
    }
    if (typeof nav.clipboard?.writeText === 'function') {
      return Promise.resolve(nav.clipboard.writeText(url)).then(
        (): ShareAppOutcome => 'copied',
        (): ShareAppOutcome => 'failed',
      )
    }
  } catch {
    return Promise.resolve('failed')
  }
  return Promise.resolve('failed')
}
