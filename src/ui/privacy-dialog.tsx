import { useEffect, useRef } from 'react'
import { strings } from './strings.es.ts'

export interface PrivacyDialogProps {
  open: boolean
  /** Called whenever the dialog closes: "Cerrar", Escape or any native close. */
  onClose: () => void
}

export function PrivacyDialog({ open, onClose }: PrivacyDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog ref={dialogRef} className="privacy-dialog" aria-labelledby="privacy-dialog-title" onClose={onClose}>
      <h2 id="privacy-dialog-title" className="privacy-dialog-title">
        {strings.privacyDialog.title}
      </h2>
      {strings.privacyDialog.paragraphs.map((paragraph) => (
        <p key={paragraph} className="privacy-dialog-text">
          {paragraph}
        </p>
      ))}
      <button type="button" className="privacy-dialog-close" onClick={() => dialogRef.current?.close()}>
        {strings.menu.close}
      </button>
    </dialog>
  )
}
