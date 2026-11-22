import { useId, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { currentNavigator, isIos } from './platform.ts'
import { useSession } from './session-store.ts'
import { gmailUrl, mailtoUrl, showDesktopSend, validateEmail, whatsappWebUrl } from './send-links.ts'
import { canSharePdf, currentShareNavigator, pdfFile, sharePdf } from './share-pdf.ts'
import { strings } from './strings.es.ts'
import { normalizeArPhone, whatsappUrl } from './whatsapp.ts'
import './print-step.css'

export function DoneStep() {
  const ios = isIos(currentNavigator())
  const pdf = useSession((s) => s.pdf)
  const [shareFailed, setShareFailed] = useState(false)
  const file = useMemo(() => pdfFile(pdf), [pdf])
  const canShare = file !== null && canSharePdf(currentShareNavigator(), file)

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
      {canShare && (
        <button type="button" className="share-button" onClick={onShare}>
          {strings.doneStep.share}
        </button>
      )}
      {shareFailed && (
        <p className="print-error" role="alert">
          {strings.doneStep.shareFailed}
        </p>
      )}
      <WhatsappPanel canShare={canShare} desktop={showDesktopSend(currentShareNavigator(), file)} />
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

function WhatsappPanel({ canShare, desktop }: { canShare: boolean; desktop: boolean }) {
  const t = strings.doneStep.whatsapp
  const d = strings.doneStep.desktop
  const email = useSession((s) => s.recipientEmail)
  const setEmail = useSession((s) => s.setRecipientEmail)
  const [emailError, setEmailError] = useState(false)
  const emailId = useId()
  const number = useSession((s) => s.whatsappNumber)
  const setNumber = useSession((s) => s.setWhatsappNumber)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<'empty' | 'invalid' | null>(null)
  const id = useId()
  const panelId = `${id}-panel`
  const inputId = `${id}-number`
  const hintId = `${id}-hint`
  const errorId = `${id}-error`

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const phone = normalizeArPhone(number)
    if (!phone.ok) {
      setError(phone.reason)
      return
    }
    setError(null)
    // Opened right here, inside the submit, so the browser treats it as a user gesture.
    window.open(whatsappUrl(phone.digits, t.message), '_blank', 'noopener,noreferrer')
  }

  // The PDF was already downloaded to reach this step; these only open the user's mail / chat.
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

  function sendWhatsappWeb() {
    const phone = normalizeArPhone(number)
    if (!phone.ok) {
      setOpen(true)
      setError(phone.reason)
      return
    }
    setError(null)
    window.open(whatsappWebUrl(phone.digits, t.message), '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      {desktop && (
        <section className="desktop-send">
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
          <button type="button" className="share-button" onClick={sendWhatsappWeb}>
            {d.sendWhatsappWeb}
          </button>
          <button type="button" className="link-button" onClick={() => sendMail(true)}>
            {d.useMailProgram}
          </button>
          <p className="print-notice whatsapp-hint">{d.dragHint}</p>
        </section>
      )}
      <button
        type="button"
        className="share-button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((o) => !o)
          setError(null)
        }}
      >
        {t.toggle}
      </button>
      <form id={panelId} className="whatsapp-panel" hidden={!open} onSubmit={onSubmit} noValidate>
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
        <button type="submit" className="share-button">
          {t.submit}
        </button>
        <ol className="whatsapp-steps">
          <li>{t.stepOpenChat}</li>
          <li>{canShare ? t.stepShare : t.stepAttach}</li>
        </ol>
      </form>
    </>
  )
}
