import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { normalizeWatermark } from '../core/index.ts'
import { wrapFocus } from './menu-model.ts'
import { pipeline } from './pipeline.ts'
import { currentNavigator, isIos } from './platform.ts'
import { printPdf } from './print-pdf.ts'
import { pdfInputsKey, sheetLayout } from './print-step-model.ts'
import { gmailUrl, mailtoUrl, validateEmail } from './send-links.ts'
import { planOutput, planSend, whatsappLink, type OutputOption, type OutputPlan, type SendPlan } from './send-plan.ts'
import { sessionStore, useSession } from './session-store.ts'
import { readPrefs } from './preferences-store.ts'
import { currentShareNavigator, pdfFile, pdfFileName, sharePdf } from './share-pdf.ts'
import { strings } from './strings.es.ts'
import { useWideLayout } from './use-wide-layout.ts'
import { normalizeArPhone } from './whatsapp.ts'
import './output-panel.css'

const FOCUSABLE = 'button, summary, a[href], input:not(:disabled), [tabindex]:not([tabindex="-1"])'
/** Typing the watermark rebuilds the PDF only after this pause. */
const TEXT_DEBOUNCE_MS = 400
/** Dragging the sheet's handle down this far closes it. */
const SWIPE_CLOSE_PX = 64
/** Time before the saved PDF's blob URL is released. */
const RELEASE_URL_MS = 10_000

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

type BuildStatus = 'building' | 'ready' | 'failed' | 'blocked'

interface CurrentPdf {
  status: BuildStatus
  /** The PDF for the current inputs; null unless `status` is 'ready'. */
  pdf: { bytes: Uint8Array; copies: 1 | 2 } | null
  file: File | null
  retry(): void
}

/**
 * Keeps an in-memory PDF built from the current inputs, so share/print/save can run inside the
 * click with no await. Any input change drops the PDF and rebuilds it (debounced for typing);
 * a late answer from an older build, or after unmount, is discarded.
 */
function useCurrentPdf(): CurrentPdf {
  const key = useSession(pdfInputsKey)
  const watermark = useSession((s) => JSON.stringify(normalizeWatermark(s.watermarkOn, s.watermarkText)))
  const canBuild = useSession(
    (s) => Boolean(s.faces.front && s.faces.back) && sheetLayout(s.profileId, s.copies, s.marginMm).ok,
  )
  const pdf = useSession((s) => s.pdf)
  const [attempt, setAttempt] = useState(0)
  const [built, setBuilt] = useState(null as { key: string; attempt: number; ok: boolean } | null)
  const lastWatermark = useRef(watermark)

  useEffect(() => {
    // Each run owns its flag: a newer run or unmount discards this run's late answer.
    let stale = false
    sessionStore.getState().clearPdf()
    const typing = lastWatermark.current !== watermark
    lastWatermark.current = watermark
    if (!canBuild) return
    const build = () => {
      const copies = sessionStore.getState().copies
      void pipeline.buildPdf(copies).then((result) => {
        if (stale) return
        if (result.ok) sessionStore.getState().setPdf(result.pdf, copies)
        setBuilt({ key, attempt, ok: result.ok })
      })
    }
    const timer = typing ? setTimeout(build, TEXT_DEBOUNCE_MS) : null
    if (!typing) build()
    return () => {
      if (timer !== null) clearTimeout(timer)
      stale = true
    }
  }, [key, watermark, canBuild, attempt])

  let status: BuildStatus = 'building'
  if (!canBuild) status = 'blocked'
  else if (built && built.key === key && built.attempt === attempt) status = built.ok && pdf ? 'ready' : built.ok ? 'building' : 'failed'
  const current = status === 'ready' ? pdf : null
  const file = useMemo(() => pdfFile(current), [current])
  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { status, pdf: current, file, retry }
}

export interface OutputPanelProps {
  /** Below 900px: whether the bottom sheet is open («Está bien» opens it). */
  sheetOpen: boolean
  onSheetClose: () => void
  /** «Está bien»: focus returns here when the sheet closes. */
  returnFocusRef?: RefObject<HTMLElement | null>
  /** «Empezar de nuevo» from the notice after acting. */
  onRestart: () => void
  /** Preferred action (story 9-6); highlighted when visible. */
  defaultAction?: OutputOption
}

/**
 * Output of step 3 «Revisá la hoja»: builds the current PDF and offers what to do with it.
 * From 900px a fixed panel beside the sheet; below, a modal bottom sheet opened by «Está bien».
 */
export function OutputPanel({ sheetOpen, onSheetClose, returnFocusRef, onRestart, defaultAction }: OutputPanelProps) {
  const wide = useWideLayout()
  const build = useCurrentPdf()
  const titleId = useId()
  // A new key on each sheet close resets the notice and the options' local state.
  const [round, setRound] = useState(0)
  const restoreFocus = useRef(true)

  // Widening with the sheet open unmounts it (a hidden modal would leave the page inert).
  useEffect(() => {
    if (wide && sheetOpen) onSheetClose()
  }, [wide, sheetOpen, onSheetClose])

  const restart = () => {
    // The step change focuses the step title; do not pull focus back to «Está bien».
    restoreFocus.current = false
    onSheetClose()
    onRestart()
  }

  const content = (
    <OutputOptions key={round} build={build} wide={wide} defaultAction={defaultAction ?? (readPrefs().defaultAction || undefined)} onRestart={restart} />
  )

  if (wide) {
    return (
      <section className="output-panel" aria-labelledby={titleId}>
        <h2 id={titleId} className="output-title">
          {strings.output.title}
        </h2>
        {content}
      </section>
    )
  }
  return (
    <OutputSheet
      open={sheetOpen}
      titleId={titleId}
      onClose={() => {
        onSheetClose()
        setRound((n) => n + 1)
        if (restoreFocus.current) returnFocusRef?.current?.focus()
        restoreFocus.current = true
      }}
      onDismiss={onSheetClose}
    >
      {content}
    </OutputSheet>
  )
}

/** Modal bottom sheet: focus trap, Escape, a tap outside or swiping its handle down close it. */
function OutputSheet({
  open,
  titleId,
  onClose,
  onDismiss,
  children,
}: {
  open: boolean
  titleId: string
  /** Runs on every close (native `close` event). */
  onClose: () => void
  /** Asks the owner to close (backdrop tap, swipe). */
  onDismiss: () => void
  children: ReactNode
}) {
  const ref = useRef(null as HTMLDialogElement | null)
  const drag = useRef(null as { id: number; y: number } | null)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const sheet = ref.current
    if (!sheet) return
    if (open && !sheet.open) {
      sheet.showModal()
      focusables(sheet)[0]?.focus()
    }
    if (!open && sheet.open) sheet.close()
  }, [open])

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return
    const controls = focusables(event.currentTarget)
    const next = wrapFocus(controls.indexOf(document.activeElement as HTMLElement), controls.length, event.shiftKey)
    if (next === -1) return
    event.preventDefault()
    controls[next].focus()
  }

  // A backdrop click targets the dialog itself and lands outside its box.
  const onClick = (event: ReactMouseEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) return
    const box = event.currentTarget.getBoundingClientRect()
    const inside =
      event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom
    if (!inside) onDismiss()
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { id: event.pointerId, y: event.clientY }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== event.pointerId) return
    setOffset(Math.max(0, event.clientY - drag.current.y))
  }
  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== event.pointerId) return
    const moved = event.type === 'pointerup' ? event.clientY - drag.current.y : 0
    drag.current = null
    setOffset(0)
    if (moved >= SWIPE_CLOSE_PX) onDismiss()
  }

  return (
    <dialog
      ref={ref}
      className="output-sheet"
      aria-labelledby={titleId}
      style={offset > 0 ? { transform: `translateY(${offset}px)` } : undefined}
      onClose={onClose}
      onKeyDown={onKeyDown}
      onClick={onClick}
    >
      <div
        className="output-sheet-handle"
        aria-hidden="true"
        data-testid="output-sheet-handle"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <span className="output-sheet-grip" />
      </div>
      <div className="output-sheet-body">
        <h2 id={titleId} className="output-title">
          {strings.output.title}
        </h2>
        {children}
      </div>
    </dialog>
  )
}

/** Visible, enabled controls in DOM order (closed <details> content does not count). */
function focusables(root: HTMLElement): HTMLElement[] {
  return ([...root.querySelectorAll(FOCUSABLE)] as HTMLElement[]).filter(
    (el) => !(el as HTMLButtonElement).disabled && el.getClientRects().length > 0,
  )
}

type After = 'shared' | 'printed' | 'saved'

function OutputOptions({
  build,
  wide,
  defaultAction,
  onRestart,
}: {
  build: CurrentPdf
  wide: boolean
  defaultAction?: OutputOption
  onRestart: () => void
}) {
  const copies = useSession((s) => s.copies)
  const [after, setAfter] = useState(null as After | null)
  const [shareFailed, setShareFailed] = useState(false)
  const [printNote, setPrintNote] = useState(null as 'unavailable' | 'failed' | 'opened' | null)
  const afterRef = useRef(null as HTMLParagraphElement | null)
  const optionsRef = useRef(null as HTMLDivElement | null)
  const returning = useRef(false)
  const ios = isIos(currentNavigator())
  // Plan with a same-named stand-in while the PDF builds, so the options do not jump around.
  const planFile = useMemo(
    () => build.file ?? new File([], pdfFileName(copies), { type: 'application/pdf' }),
    [build.file, copies],
  )
  const nav = { ...navInfo(), ...shareNav() }
  const plan = planOutput(nav, planFile, { wide, defaultAction })
  const sendPlan = planSend(nav, planFile)
  const ready = build.status === 'ready' && build.file !== null

  useEffect(() => {
    if (after) afterRef.current?.focus()
    else if (returning.current) {
      returning.current = false
      optionsRef.current?.querySelector<HTMLElement>('[data-highlighted="true"]')?.focus()
    }
  }, [after])

  const act = (fn: (file: File) => void) => () => {
    if (!ready || !build.file) return
    setShareFailed(false)
    setPrintNote(null)
    fn(build.file)
  }

  // Each action starts right inside the click (no await before it), with the PDF already built.
  const onShare = act((file) => {
    void sharePdf(currentShareNavigator(), file).then((outcome) => {
      if (outcome === 'shared') setAfter('shared')
      else if (outcome === 'failed') setShareFailed(true)
    })
  })
  const onPrint = act((file) => {
    void printPdf(file).then((outcome) => {
      if (outcome === 'printed' || outcome === 'shared') setAfter('printed')
      else if (outcome === 'opened' || outcome === 'unavailable' || outcome === 'failed') setPrintNote(outcome)
    })
  })
  // Downloads the current PDF; must run inside a click.
  function downloadPdf(): boolean {
    const pdf = build.pdf
    if (!pdf) return false
    const store = sessionStore.getState()
    const url = store.createPdfUrl(pdf.bytes)
    const link = document.createElement('a')
    link.href = url
    link.download = pdfFileName(pdf.copies)
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => sessionStore.getState().releaseUrl(url), RELEASE_URL_MS)
    return true
  }
  const onSave = act(() => {
    if (downloadPdf()) setAfter('saved')
  })

  if (after) {
    return (
      <div className="output-after">
        <p ref={afterRef} className="output-after-text" role="status" tabIndex={-1}>
          {strings.output.after[after]}
        </p>
        <button
          type="button"
          className="output-secondary"
          onClick={() => {
            returning.current = true
            setAfter(null)
          }}
        >
          {strings.output.another}
        </button>
        <button type="button" className="output-link" onClick={onRestart}>
          {strings.output.restart}
        </button>
      </div>
    )
  }

  const o = strings.output.options
  const cards: Record<Exclude<OutputOption, 'send'>, { icon: IconName; title: string; help: string; onClick: () => void }> = {
    share: { icon: 'share', title: o.share.title, help: o.share.help, onClick: onShare },
    print: { icon: 'print', title: o.print.title, help: ios ? o.print.helpIos : o.print.help, onClick: onPrint },
    save: { icon: 'save', title: o.save.title[plan.saveLabel], help: o.save.help[plan.saveLabel], onClick: onSave },
  }

  return (
    <div className="output-options" ref={optionsRef}>
      {build.status === 'building' && (
        <p className="output-status" role="status">
          {strings.output.preparing}
        </p>
      )}
      {build.status === 'failed' && (
        <div className="output-failed">
          <p className="print-error" role="alert">
            {strings.output.buildFailed}
          </p>
          <button type="button" className="output-secondary" onClick={build.retry}>
            {strings.output.retry}
          </button>
        </div>
      )}
      {plan.options.map((option) => {
        if (option === 'send') {
          return <SendOption key={option} plan={plan} sendPlan={sendPlan} ready={ready} download={downloadPdf} />
        }
        const card = cards[option]
        return (
          <div key={option} className="output-item">
            <OptionCard
              option={option}
              highlighted={plan.highlighted === option}
              disabled={!ready}
              icon={card.icon}
              title={card.title}
              help={card.help}
              onClick={card.onClick}
            />
            {option === 'share' && shareFailed && (
              <p className="print-error" role="alert">
                {strings.output.shareFailed}
              </p>
            )}
            {option === 'print' && printNote && (
              <p className={printNote === 'failed' ? 'print-error' : 'print-notice hint'} role={printNote === 'failed' ? 'alert' : 'status'}>
                {printNote === 'failed' ? strings.output.printFailed : printNote === 'opened' ? strings.output.printOpened : strings.output.printUnavailable}
              </p>
            )}
            {option === 'save' && ios && <IosGuide />}
          </div>
        )
      })}
    </div>
  )
}

function OptionCard({
  option,
  highlighted,
  disabled,
  icon,
  title,
  help,
  onClick,
}: {
  option: OutputOption
  highlighted: boolean
  disabled: boolean
  icon: IconName
  title: string
  help: string
  onClick: () => void
}) {
  const id = useId()
  // aria-disabled keeps the card focusable while the PDF is being built.
  return (
    <button
      type="button"
      className="output-card"
      data-option={option}
      data-highlighted={highlighted}
      aria-disabled={disabled || undefined}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-help`}
      onClick={onClick}
    >
      <Icon name={icon} />
      <span className="output-card-text">
        <span id={`${id}-title`} className="output-card-title">
          {title}
        </span>
        <span id={`${id}-help`} className="output-card-help">
          {help}
        </span>
      </span>
    </button>
  )
}

function IosGuide() {
  const id = useId()
  return (
    <section className="ios-guide" aria-labelledby={id}>
      <h3 id={id} className="ios-guide-title">
        {strings.output.iosGuideTitle}
      </h3>
      <ol>
        {strings.output.iosGuideSteps.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ol>
    </section>
  )
}

/** «Mandar a un número de WhatsApp o un mail»: a disclosure card with the number and mail fields. */
function SendOption({ plan, sendPlan, ready, download }: { plan: OutputPlan; sendPlan: SendPlan; ready: boolean; download: () => boolean }) {
  const t = strings.output.whatsapp
  const d = strings.output.desktop
  const s = strings.output.send
  const o = strings.output.options.send
  const email = useSession((st) => st.recipientEmail)
  const setEmail = useSession((st) => st.setRecipientEmail)
  const [emailError, setEmailError] = useState(false)
  const number = useSession((st) => st.whatsappNumber)
  const setNumber = useSession((st) => st.setWhatsappNumber)
  const [error, setError] = useState(null as 'empty' | 'invalid' | null)
  const [hint, setHint] = useState(false)
  const id = useId()
  const emailId = `${id}-email`
  const inputId = `${id}-number`
  const hintId = `${id}-hint`
  const errorId = `${id}-error`

  // Links open right here, inside the click, so the browser treats them as a user gesture.
  // Without Web Share the PDF is saved first (inside the same click) so the user can paste it.
  function beforeOpen() {
    if (!ready) return false
    if (!sendPlan.share) {
      if (!download()) return false
      setHint(true)
    } else setHint(false)
    return true
  }

  function sendWhatsapp() {
    const phone = normalizeArPhone(number)
    if (!phone.ok) {
      setError(phone.reason)
      setHint(false)
      return
    }
    setError(null)
    if (!beforeOpen()) return
    window.open(whatsappLink(sendPlan, phone.digits, t.message), '_blank', 'noopener,noreferrer')
  }

  function sendMail(program: boolean) {
    const valid = validateEmail(email)
    if (!valid.ok) {
      setEmailError(true)
      setHint(false)
      return
    }
    setEmailError(false)
    if (!beforeOpen()) return
    const url = program ? mailtoUrl(valid.email, d.mailSubject, d.mailBody) : gmailUrl(valid.email, d.mailSubject, d.mailBody)
    if (program) window.location.href = url
    else window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <details className="output-item output-send" open={plan.sendOpen || undefined}>
      <summary className="output-card" data-option="send" data-highlighted={plan.highlighted === 'send'}>
        <Icon name="send" />
        <span className="output-card-text">
          <span className="output-card-title">{o.title}</span>
          <span className="output-card-help">{o.help}</span>
        </span>
      </summary>
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
        <button type="button" className="share-button" disabled={!ready} onClick={sendWhatsapp}>
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
        <button type="button" className="share-button" disabled={!ready} onClick={() => sendMail(false)}>
          {d.sendMail}
        </button>
        {sendPlan.mailProgram && (
          <button type="button" className="link-button" disabled={!ready} onClick={() => sendMail(true)}>
            {d.useMailProgram}
          </button>
        )}
        {hint && (
          <p className="print-notice whatsapp-hint" role="status">
            {s.attachHint}
          </p>
        )}
      </div>
    </details>
  )
}

const ICONS = {
  share: 'M12 15V3M7 8l5-5 5 5M5 12v8h14v-8',
  print: 'M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z',
  save: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  send: 'M4 5h16v11H9l-5 4z',
} as const
type IconName = keyof typeof ICONS

function Icon({ name }: { name: IconName }) {
  return (
    <svg className="output-card-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={ICONS[name]} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
