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
  /** Extra «drag the PDF» message (desktop). */
  dragHint: boolean
  /** «Otras formas de enviar» starts open when there is no share row. */
  othersOpen: boolean
}

export function planSend(nav: NavigatorInfo & ShareNavigator, file: File | null): SendPlan {
  const share = file !== null && canSharePdf(nav, file)
  const desktop = isDesktop(nav)
  return { share, whatsapp: desktop ? 'web' : 'wa.me', mailProgram: desktop, dragHint: desktop, othersOpen: !share }
}

export function whatsappLink(plan: SendPlan, digits: string, text: string): string {
  return plan.whatsapp === 'web' ? whatsappWebUrl(digits, text) : whatsappUrl(digits, text)
}
