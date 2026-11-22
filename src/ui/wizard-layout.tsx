import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { updatePrompt } from './update-prompt.ts'
import { AppMenu } from './app-menu.tsx'
import { Brand } from './brand.tsx'
import { strings } from './strings.es.ts'
import { STEP_COUNT } from './wizard-steps.ts'
import './wizard-layout.css'

export interface WizardLayoutProps {
  /** 1-based step number (1–3). */
  stepNumber: number
  title: string
  /** Shows the header's back button when present. */
  onBack?: () => void
  primaryLabel: string
  onPrimary: () => void
  primaryDisabled?: boolean
  onRestart?: () => void
  children: ReactNode
}

const SEGMENTS = Array.from({ length: STEP_COUNT }, (_, index) => index + 1)

export function WizardLayout({
  stepNumber,
  title,
  onBack,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  onRestart,
  children,
}: WizardLayoutProps) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const firstRender = useRef(true)
  const [announcement, setAnnouncement] = useState('')
  // On a step change (not on first load) focus goes to the title and the step is announced.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    titleRef.current?.focus()
    setAnnouncement(strings.wizard.stepAnnouncement(stepNumber, STEP_COUNT, title))
  }, [title, stepNumber])
  const updateAvailable = useSyncExternalStore(updatePrompt.subscribe, updatePrompt.getSnapshot)
  return (
    <div className="wizard">
      <header className="wizard-header">
        <div className="wizard-header-bar">
          <Brand />
          {updateAvailable && (
            <div className="wizard-update" role="status">
              <span>{strings.update.available}</span>
              <button type="button" className="wizard-update-action" onClick={() => void updatePrompt.update()}>
                {strings.update.action}
              </button>
            </div>
          )}
          <AppMenu onRestart={onRestart} />
        </div>
        {onBack && (
          <div className="wizard-back-row">
            <button type="button" className="wizard-back" onClick={onBack}>
              {strings.wizard.back}
            </button>
          </div>
        )}
        <div
          className="wizard-progress"
          role="progressbar"
          aria-label={strings.wizard.progressLabel}
          aria-valuemin={1}
          aria-valuemax={STEP_COUNT}
          aria-valuenow={stepNumber}
          aria-valuetext={strings.wizard.stepCounter(stepNumber, STEP_COUNT)}
        >
          {SEGMENTS.map((segment) => (
            <span
              key={segment}
              className="wizard-progress-segment"
              data-filled={segment <= stepNumber}
            />
          ))}
        </div>
        <ol className="wizard-step-labels" aria-hidden="true">
          {strings.wizard.stepLabels.map((name, i) => (
            <li key={name} data-current={i + 1 === stepNumber}>{name}</li>
          ))}
        </ol>
        <p className="wizard-counter" aria-hidden="true">{strings.wizard.stepCounter(stepNumber, STEP_COUNT)}</p>
        <h1 className="wizard-title" ref={titleRef} tabIndex={-1}>
          {title}
        </h1>
        <p className="visually-hidden" role="status">
          {announcement}
        </p>
      </header>
      <main className="wizard-body">{children}</main>
      <footer className="wizard-footer">
        <button type="button" className="button-primary" onClick={onPrimary} disabled={primaryDisabled}>
          {primaryLabel}
        </button>
      </footer>
    </div>
  )
}
