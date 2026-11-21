import type { ReactNode } from 'react'
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
  children: ReactNode
}

const SEGMENTS = Array.from({ length: STEP_COUNT }, (_, index) => index + 1)

export function WizardLayout({
  stepNumber,
  title,
  onBack,
  primaryLabel,
  onPrimary,
  children,
}: WizardLayoutProps) {
  return (
    <div className="wizard">
      <header className="wizard-header">
        <div className="wizard-header-bar">
          {onBack && (
            <button type="button" className="wizard-back" onClick={onBack}>
              {strings.wizard.back}
            </button>
          )}
        </div>
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
        <p className="wizard-counter" aria-hidden="true">{strings.wizard.stepCounter(stepNumber, STEP_COUNT)}</p>
        <h1 className="wizard-title">{title}</h1>
      </header>
      <main className="wizard-body">{children}</main>
      <footer className="wizard-footer">
        <button type="button" className="button-primary" onClick={onPrimary}>
          {primaryLabel}
        </button>
      </footer>
    </div>
  )
}
