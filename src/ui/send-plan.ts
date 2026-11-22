// Pure decisions for the unified "Enviar" section: which rows show and where links go.

import { isDesktop } from './platform.ts'
import type { NavigatorInfo } from './platform.ts'
import { whatsappWebUrl } from './send-links.ts'
import { canSharePdf } from './share-pdf.ts'
import type { ShareNavigator } from './share-pdf.ts'
import { whatsappUrl } from './whatsapp.ts'

export interface SendPlan {
  /** «Compartir PDF» row (main action) only where the browser accepts the file. */
  share: boolean
  /** WhatsApp Web on desktop, wa.me otherwise. */
  whatsapp: 'web' | 'wa.me'
  /** «Usar mi programa de correo» alternative (desktop). */
  mailProgram: boolean
  /** «Otras formas de enviar» starts open when there is no share row. */
  othersOpen: boolean
}

export function planSend(nav: NavigatorInfo & ShareNavigator, file: File | null): SendPlan {
  const share = file !== null && canSharePdf(nav, file)
  const desktop = isDesktop(nav)
  return { share, whatsapp: desktop ? 'web' : 'wa.me', mailProgram: desktop, othersOpen: !share }
}

export function whatsappLink(plan: SendPlan, digits: string, text: string): string {
  return plan.whatsapp === 'web' ? whatsappWebUrl(digits, text) : whatsappUrl(digits, text)
}

/** The output options of step 3 «Revisá la hoja», in display order. */
export type OutputOption = 'share' | 'print' | 'save' | 'send'

export interface OutputPlan {
  /** Visible options, always in the order share, print, save, send (share only with Web Share of the file). */
  options: OutputOption[]
  /** The one card styled as the primary action. */
  highlighted: OutputOption
  /** «Mandar a un número de WhatsApp o un mail» starts open when there is no share option. */
  sendOpen: boolean
  /** «Guardar en el teléfono» off desktop, «Guardar PDF» on desktop. */
  saveLabel: 'phone' | 'pdf'
}

export interface OutputContext {
  /** True from 900px (side panel), false below (bottom sheet). */
  wide: boolean
  /** Preferred action (story 9-6); used only when that option is visible. */
  defaultAction?: OutputOption
}

/**
 * Which output options show and which one is highlighted: the default action when visible;
 * otherwise Imprimir on wide windows; otherwise Compartir when visible; otherwise Imprimir.
 */
export function planOutput(nav: NavigatorInfo & ShareNavigator, file: File | null, { wide, defaultAction }: OutputContext): OutputPlan {
  const send = planSend(nav, file)
  const options: OutputOption[] = [...(send.share ? (['share'] as const) : []), 'print', 'save', 'send']
  let highlighted: OutputOption
  if (defaultAction && options.includes(defaultAction)) highlighted = defaultAction
  else if (wide) highlighted = 'print'
  else highlighted = send.share ? 'share' : 'print'
  return { options, highlighted, sendOpen: send.othersOpen, saveLabel: isDesktop(nav) ? 'pdf' : 'phone' }
}
