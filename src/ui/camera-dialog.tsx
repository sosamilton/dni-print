import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { strings } from './strings.es.ts'
import './camera-dialog.css'

export interface CameraDialogProps {
  /** Called with the captured JPEG, or null when the user cancels or the camera is unavailable. */
  onClose: (file: File | null) => void
}

/** Live webcam preview (desktop): the browser asks for permission, then "Sacar" grabs one frame. */
export function CameraDialog({ onClose }: CameraDialogProps) {
  const dialogRef = useRef(null as HTMLDialogElement | null)
  const videoRef = useRef(null as HTMLVideoElement | null)
  const shootRef = useRef(null as HTMLButtonElement | null)
  const streamRef = useRef(null as MediaStream | null)
  // Without a secure context (plain http on a LAN address) the browser exposes no camera API at all.
  const [error, setError] = useState((): string | null =>
    typeof navigator.mediaDevices?.getUserMedia === 'function' ? null : window.isSecureContext ? strings.camera.unavailable : strings.camera.insecure,
  )
  const [ready, setReady] = useState(false)
  const [devices, setDevices] = useState([] as MediaDeviceInfo[])
  const [deviceId, setDeviceId] = useState('')
  const [shot, setShot] = useState(null as Blob | null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  useEffect(() => {
    if (typeof navigator.mediaDevices?.getUserMedia !== 'function') return
    let alive = true
    setReady(false)
    const video: MediaTrackConstraints = deviceId
      ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
      : { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
    navigator.mediaDevices
      .getUserMedia({ video, audio: false })
      .then((stream) => {
        if (!alive) return stream.getTracks().forEach((t) => t.stop())
        streamRef.current = stream
        const el = videoRef.current
        if (el) {
          el.srcObject = stream
          void el.play().then(() => alive && setReady(true))
        }
        // Labels and the full list only exist once permission is granted.
        void navigator.mediaDevices
          .enumerateDevices()
          .then((list) => alive && setDevices(list.filter((d) => d.kind === 'videoinput')))
          .catch(() => {})
      })
      .catch((e: unknown) => {
        if (!alive) return
        const denied = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')
        setError(denied ? strings.camera.denied : strings.camera.unavailable)
      })
    return () => {
      alive = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [deviceId])

  // Enter/Space then shoot right away: the primary button takes focus as soon as the camera is live.
  useEffect(() => {
    if (ready) shootRef.current?.focus()
  }, [ready])

  /** Grabs the frame as shown (no mirroring) and freezes the preview so it can be reviewed. */
  function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth || shot) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) return onClose(null)
      video.pause()
      setShot(blob)
    }, 'image/jpeg', 0.95)
  }

  function retake() {
    setShot(null)
    void videoRef.current?.play()
  }

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if ((event.key !== 'Enter' && event.key !== ' ') || event.target instanceof HTMLButtonElement || event.target instanceof HTMLSelectElement) return
    event.preventDefault()
    if (ready && !shot) capture()
  }

  const hasChoice = devices.length !== 0 && devices.length !== 1

  return (
    <dialog ref={dialogRef} className="camera-dialog" aria-labelledby="camera-dialog-title" onClose={() => onClose(null)} onKeyDown={onKeyDown}>
      <h2 id="camera-dialog-title" className="camera-dialog-title">
        {strings.camera.title}
      </h2>
      {error && (
        <p className="camera-dialog-error" role="alert">
          {error}
        </p>
      )}
      {!error && hasChoice && (
        <label className="camera-dialog-select">
          <span>{strings.camera.cameraSelect}</span>
          <select
            className="load-select"
            value={deviceId || devices[0]?.deviceId}
            disabled={Boolean(shot)}
            onChange={(e) => setDeviceId(e.target.value)}
          >
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || strings.camera.cameraFallback(i + 1)}
              </option>
            ))}
          </select>
        </label>
      )}
      {!error && (
        <div className="camera-dialog-stage">
          <video ref={videoRef} className="camera-dialog-video" playsInline muted aria-label={strings.camera.previewLabel} />
          <div className="camera-dialog-guide" aria-hidden="true" />
          <p className="camera-dialog-hint">{strings.camera.guide}</p>
        </div>
      )}
      <div className="camera-dialog-actions">
        <button type="button" className="face-action" onClick={() => dialogRef.current?.close()}>
          {strings.camera.cancel}
        </button>
        {!error && shot && (
          <>
            <button type="button" className="face-action" onClick={retake}>
              {strings.camera.retake}
            </button>
            <button
              type="button"
              className="button-primary camera-dialog-shoot"
              autoFocus
              onClick={() => onClose(new File([shot], 'camara.jpg', { type: 'image/jpeg' }))}
            >
              {strings.camera.accept}
            </button>
          </>
        )}
        {!error && !shot && (
          <button ref={shootRef} type="button" className="button-primary camera-dialog-shoot" disabled={!ready} onClick={capture}>
            {strings.camera.shoot}
          </button>
        )}
      </div>
    </dialog>
  )
}
