import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { FACE_FILTERS, MAX_WATERMARK_CHARS } from '../core/index.ts'
import type { FaceFilter } from '../core/index.ts'
import { DEFAULT_ACTIONS, THEME_CHOICES, type DefaultAction, type Prefs } from './preferences.ts'
import { clearAllPrefs, readPrefs, savePrefs } from './preferences-store.ts'
import { MAX_MARGIN_MM, MIN_MARGIN_MM } from './print-step-model.ts'
import { validateEmail } from './send-links.ts'
import { strings } from './strings.es.ts'
import { themeStore } from './theme.ts'
import { normalizeArPhone } from './whatsapp.ts'

export interface PreferencesDialogProps {
  open: boolean
  /** Called whenever the dialog closes: "Cerrar", Escape or any native close. */
  onClose: () => void
}

const copy = strings.preferences

export function PreferencesDialog({ open, onClose }: PreferencesDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog ref={dialogRef} className="privacy-dialog prefs-dialog" aria-labelledby="prefs-dialog-title" onClose={onClose}>
      <h2 id="prefs-dialog-title" className="privacy-dialog-title">
        {copy.title}
      </h2>
      {open && <PreferencesForm onClose={() => dialogRef.current?.close()} />}
    </dialog>
  )
}

function PreferencesForm({ onClose }: { onClose: () => void }) {
  const [initial] = useState(() => readPrefs())
  const theme = useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot)
  const [defaultAction, setDefaultAction] = useState(initial.defaultAction as DefaultAction)
  const [copies, setCopies] = useState(initial.copies as 1 | 2)
  const [filter, setFilter] = useState(initial.filter as FaceFilter)
  const [margin, setMargin] = useState(String(initial.marginMm))
  const [watermark, setWatermark] = useState(initial.watermark)
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp)
  const [email, setEmail] = useState(initial.email)
  const [errors, setErrors] = useState({ whatsapp: false, email: false, margin: false, watermark: false })
  const [status, setStatus] = useState('')

  const save = () => {
    const marginMm = Number(margin)
    const next = {
      whatsapp: whatsapp.trim() !== '' && !normalizeArPhone(whatsapp).ok,
      email: email.trim() !== '' && !validateEmail(email).ok,
      watermark: Array.from(watermark.trim()).length > MAX_WATERMARK_CHARS,
      margin: !(Number.isInteger(marginMm) && marginMm >= MIN_MARGIN_MM && marginMm <= MAX_MARGIN_MM),
    }
    setErrors(next)
    if (next.whatsapp || next.email || next.margin || next.watermark) {
      setStatus('')
      return
    }
    const prefs: Prefs = {
      theme: themeStore.getSnapshot(),
      whatsapp: whatsapp.trim(),
      email: email.trim(),
      defaultAction,
      copies,
      filter,
      marginMm,
      watermark: watermark.trim(),
    }
    savePrefs(prefs)
    themeStore.reload()
    setStatus(copy.saved)
  }

  const erase = async () => {
    await clearAllPrefs()
    themeStore.reload()
    setDefaultAction('')
    setCopies(2)
    setFilter('color')
    setMargin('10')
    setWatermark('')
    setWhatsapp('')
    setEmail('')
    setErrors({ whatsapp: false, email: false, margin: false, watermark: false })
    setStatus(copy.erased)
  }

  return (
    <form
      className="prefs-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
    >
      <p className="privacy-dialog-text">{copy.intro}</p>
      <p className="privacy-dialog-text">{copy.restartNote}</p>

      <fieldset className="prefs-field">
        <legend>{strings.menu.theme.label}</legend>
        <div className="prefs-options">
          {THEME_CHOICES.map((option) => (
            <button key={option} type="button" className="prefs-option" aria-pressed={theme === option} onClick={() => themeStore.setChoice(option)}>
              {strings.menu.theme.options[option]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="prefs-field">
        <legend>{copy.defaultActionLabel}</legend>
        <div className="prefs-options">
          {(['', ...DEFAULT_ACTIONS] as const).map((option) => (
            <button key={option} type="button" className="prefs-option" aria-pressed={defaultAction === option} onClick={() => setDefaultAction(option)}>
              {copy.defaultActions[option]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="prefs-field">
        <legend>{copy.copiesLabel}</legend>
        <div className="prefs-options">
          {([1, 2] as const).map((option) => (
            <button key={option} type="button" className="prefs-option" aria-pressed={copies === option} onClick={() => setCopies(option)}>
              {strings.printStep.copies[option]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="prefs-field">
        <legend>{copy.filterLabel}</legend>
        <div className="prefs-options">
          {FACE_FILTERS.map((option) => (
            <button key={option} type="button" className="prefs-option" aria-pressed={filter === option} onClick={() => setFilter(option)}>
              {strings.printStep.filters[option]}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="prefs-field">
        <span>{copy.marginLabel}</span>
        <input
          className="prefs-input"
          type="number"
          inputMode="numeric"
          min={MIN_MARGIN_MM}
          max={MAX_MARGIN_MM}
          value={margin}
          aria-invalid={errors.margin}
          onChange={(event) => setMargin(event.target.value)}
        />
        {errors.margin && <span className="prefs-error" role="alert">{copy.invalidMargin}</span>}
      </label>

      <label className="prefs-field">
        <span>{copy.watermarkLabel}</span>
        <input
          className="prefs-input"
          type="text"
          placeholder={strings.printStep.watermarkPlaceholder}
          value={watermark}
          aria-invalid={errors.watermark}
          onChange={(event) => setWatermark(event.target.value)}
        />
        {errors.watermark && <span className="prefs-error" role="alert">{copy.invalidWatermark(MAX_WATERMARK_CHARS)}</span>}
      </label>

      <label className="prefs-field">
        <span>{copy.whatsappLabel}</span>
        <input
          className="prefs-input"
          type="tel"
          inputMode="tel"
          value={whatsapp}
          aria-invalid={errors.whatsapp}
          onChange={(event) => setWhatsapp(event.target.value)}
        />
        {errors.whatsapp && <span className="prefs-error" role="alert">{copy.invalidWhatsapp}</span>}
      </label>

      <label className="prefs-field">
        <span>{copy.emailLabel}</span>
        <input
          className="prefs-input"
          type="email"
          inputMode="email"
          value={email}
          aria-invalid={errors.email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {errors.email && <span className="prefs-error" role="alert">{copy.invalidEmail}</span>}
      </label>

      <p className="privacy-dialog-text" role="status">{status}</p>

      <button type="submit" className="privacy-dialog-close">{copy.save}</button>
      <button type="button" className="prefs-erase" onClick={() => void erase()}>{copy.erase}</button>
      <button type="button" className="prefs-secondary" onClick={onClose}>{copy.close}</button>
    </form>
  )
}
