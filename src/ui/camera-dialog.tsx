import { useEffect, useRef, useState } from 'react'
import { strings } from './strings.es.ts'
import './camera-dialog.css'

export interface CameraDialogProps {
  /** Called with the captured JPEG, or null when the user cancels or the camera is unavailable. */
  onClose: (file: File | null) => void
}

/** Live webcam preview (desktop): the browser asks for permission, then "Sacar" grabs one frame. */
export function CameraDialog({ onClose }: CameraDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    let alive = true
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((stream) => {
        if (!alive) return stream.getTracks().forEach((t) => t.stop())
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          void video.play().then(() => alive && setReady(true))
        }
      })
      .catch((e: unknown) => {
        if (!alive) return
        const denied = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')
        setError(denied ? strings.camera.denied : strings.camera.unavailable)
      })
    return () => {
      alive = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => onClose(blob ? new File([blob], 'camara.jpg', { type: 'image/jpeg' }) : null),
      'image/jpeg',
      0.95,
    )
  }

  return (
    <dialog ref={dialogRef} className="camera-dialog" aria-labelledby="camera-dialog-title" onClose={() => onClose(null)}>
      <h2 id="camera-dialog-title" className="camera-dialog-title">
        {strings.camera.title}
      </h2>
      {error ? (
        <p className="camera-dialog-error" role="alert">
          {error}
        </p>
      ) : (
        <video ref={videoRef} className="camera-dialog-video" playsInline muted aria-label={strings.camera.previewLabel} />
      )}
      <div className="camera-dialog-actions">
        <button type="button" className="face-action" onClick={() => dialogRef.current?.close()}>
          {strings.camera.cancel}
        </button>
        {!error && (
          <button type="button" className="button-primary camera-dialog-shoot" disabled={!ready} onClick={capture}>
            {strings.camera.shoot}
          </button>
        )}
      </div>
    </dialog>
  )
}
