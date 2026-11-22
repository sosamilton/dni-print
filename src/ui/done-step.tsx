import { useId, useMemo, useState } from 'react'
import { currentNavigator, isIos } from './platform.ts'
import { useSession } from './session-store.ts'
import { gmailUrl, mailtoUrl, validateEmail } from './send-links.ts'
import { planSend, whatsappLink } from './send-plan.ts'
import type { SendPlan } from './send-plan.ts'
import { currentShareNavigator, pdfFile, sharePdf } from './share-pdf.ts'
import { strings } from './strings.es.ts'
import { normalizeArPhone } from './whatsapp.ts'
import './print-step.css'

// Copy the fields explicitly: a real Navigator has no own properties, so spreading it yields nothing.
function navInfo() {
  const n = currentNavigator()
  return { userAgent: n.userAgent, platform: n.platform, maxTouchPoints: n.maxTouchPoints }
}
// Keep the real navigator's methods bound: spreading would lose them.
function shareNav() {
  const n = currentShareNavigator()
  return {
    canShare: n.canShare ? n.canShare.bind(n) : undefined,
    share: n.share ? n.share.bind(n) : undefined,
  }
}

export function DoneStep() {
  const ios = isIos(currentNavigator())
  const pdf = useSession((s) => s.pdf)
  const [shareFailed, setShareFailed] = useState(false)
  const file = useMemo(() => pdfFile(pdf), [pdf])
  const plan = planSend({ ...navInfo(), ...shareNav() }, file)

  function onShare() {
    if (!file) return
    setShareFailed(false)
    // No await before share(): the call must stay inside the user gesture.
    void sharePdf(currentShareNavigator(), file).then((outcome) => setShareFailed(outcome === 'failed'))
  }

  return (
    <div className="print-step done-step">
      <p className="print-notice">{strings.doneStep.instruction}</p>
      <p className="print-notice">{strings.steps.done.note}</p>
      <SendSection plan={plan} onShare={onShare} shareFailed={shareFailed} />
      {ios && (
        <section className="ios-guide" aria-labelledby="ios-guide-title">
          <h2 id="ios-guide-title" className="ios-guide-title">
            {strings.doneStep.iosGuideTitle}
          </h2>
          <ol>
            {strings.doneStep.iosGuideSteps.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}

function SendSection({ plan, onShare, shareFailed }: { plan: SendPlan; onShare: () => void; shareFailed: boolean }) {
  const t = strings.doneStep.whatsapp
  const d = strings.doneStep.desktop
  const s = strings.doneStep.send
  const email = useSession((st) => st.recipientEmail)
  const setEmail = useSession((st) => st.setRecipientEmail)
  const [emailError, setEmailError] = useState(false)
  const number = useSession((st) => st.whatsappNumber)
  const setNumber = useSession((st) => st.setWhatsappNumber)
  const [error, setError] = useState<'empty' | 'invalid' | null>(null)
  const id = useId()
  const emailId = `${id}-email`
  const inputId = `${id}-number`
  const hintId = `${id}-hint`
  const errorId = `${id}-error`

  // Links open right here, inside the click, so the browser treats them as a user gesture.
  // The PDF was already downloaded to reach this step; these only open the user's chat / mail.
  function sendWhatsapp() {
    const phone = normalizeArPhone(number)
    if (!phone.ok) {
      setError(phone.reason)
      return
    }
    setError(null)
    window.open(whatsappLink(plan, phone.digits, t.message), '_blank', 'noopener,noreferrer')
  }

  function sendMail(program: boolean) {
    const valid = validateEmail(email)
    if (!valid.ok) {
      setEmailError(true)
      return
    }
    setEmailError(false)
    const url = program ? mailtoUrl(valid.email, d.mailSubject, d.mailBody) : gmailUrl(valid.email, d.mailSubject, d.mailBody)
    if (program) window.location.href = url
    else window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="send-section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="ios-guide-title">
        {s.title}
      </h2>
      {plan.share && (
        <button type="button" className="share-button share-primary" onClick={onShare}>
          {strings.doneStep.share}
        </button>
      )}
      {shareFailed && (
        <p className="print-error" role="alert">
          {strings.doneStep.shareFailed}
        </p>
      )}
      <details className="send-others" open={plan.othersOpen || undefined}>
        <summary>{s.others}</summary>
        <div className="desktop-send">
          <label htmlFor={inputId} className="whatsapp-label">
            {t.label}
          </label>
          <input
            id={inputId}
            className="print-watermark-field"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={number}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            aria-invalid={error ? true : undefined}
            onKeyDown={(event) => {
              if (event.key === 'Enter') sendWhatsapp()
            }}
            onChange={(event) => {
              setNumber(event.target.value)
              setError(null)
            }}
          />
          <p id={hintId} className="print-notice whatsapp-hint">
            {t.hint}
          </p>
          {error && (
            <p id={errorId} className="print-error" role="alert">
              {error === 'empty' ? t.empty : t.invalid}
            </p>
          )}
          <button type="button" className="share-button" onClick={sendWhatsapp}>
            {s.whatsappButton}
          </button>
          <label htmlFor={emailId} className="whatsapp-label">
            {d.emailLabel}
          </label>
          <input
            id={emailId}
            className="print-watermark-field"
            type="email"
            inputMode="email"
            autoComplete="off"
            value={email}
            aria-invalid={emailError ? true : undefined}
            onKeyDown={(event) => {
              if (event.key === 'Enter') sendMail(false)
            }}
            onChange={(event) => {
              setEmail(event.target.value)
              setEmailError(false)
            }}
          />
          {emailError && (
            <p className="print-error" role="alert">
              {d.emailInvalid}
            </p>
          )}
          <button type="button" className="share-button" onClick={() => sendMail(false)}>
            {d.sendMail}
          </button>
          {plan.mailProgram && (
            <button type="button" className="link-button" onClick={() => sendMail(true)}>
              {d.useMailProgram}
            </button>
          )}
          <p className="print-notice whatsapp-hint">{s.attachHint}</p>
          {plan.dragHint && <p className="print-notice whatsapp-hint">{d.dragHint}</p>}
        </div>
      </details>
    </section>
  )
}
