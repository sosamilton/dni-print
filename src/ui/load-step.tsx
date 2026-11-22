import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { PROFILES } from '../core/profiles.ts'
import { isBlurry } from '../core/index.ts'
import type { BitmapLike } from '../core/index.ts'
import type { FaceId } from '../worker/api.ts'
import { faceStatus, thumbnailView } from './load-step-model.ts'
import { pipeline } from './pipeline.ts'
import { CameraDialog } from './camera-dialog.tsx'
import { currentNavigator, isDesktop } from './platform.ts'
import { useSession } from './session-store.ts'
import { strings } from './strings.es.ts'
import './load-step.css'

const FACE_IDS: FaceId[] = ['front', 'back']


/**
 * True unless the browser reports devices and none is a camera. An empty or failed list proves
 * nothing (browsers hide devices until permission is granted), so the camera stays available and
 * the camera dialog reports the real failure.
 */
function useHasCamera(): boolean {
  const [has, setHas] = useState(true)
  useEffect(() => {
    let alive = true
    const devices = navigator.mediaDevices
    if (!devices?.enumerateDevices) return
    devices
      .enumerateDevices()
      .then((list) => alive && setHas(list.length === 0 || list.some((d) => d.kind === 'videoinput')))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return has
}

function Thumbnail({ bitmap, label }: { bitmap: BitmapLike; label: string }) {
  const ref = useRef(null as HTMLCanvasElement | null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    try {
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      ctx.drawImage(bitmap as unknown as CanvasImageSource, 0, 0)
    } catch {
      // Bitmap already closed (session cleared); nothing to draw.
    }
  }, [bitmap])
  return <canvas ref={ref} className="face-thumb" role="img" aria-label={label} />
}

function Icon({ d }: { d: string }) {
  return (
    <svg className="face-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

interface FaceSlotProps {
  faceId: FaceId
  hasCamera: boolean
  /** True when a pasted image should land in this face. */
  pasteTarget: boolean
  onFocusFace: (id: FaceId) => void
}

function FaceSlot({ faceId, hasCamera, pasteTarget, onFocusFace }: FaceSlotProps) {
  const face = useSession((s) => s.faces[faceId])
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  // Desktop browsers ignore `capture`, so they get a live webcam dialog instead.
  const liveCamera = isDesktop(currentNavigator())
  const galleryRef = useRef(null as HTMLInputElement | null)
  const cameraRef = useRef(null as HTMLInputElement | null)
  const label = strings.loadStep.faces[faceId]
  const status = faceStatus({ loaded: Boolean(face), processing, error: error !== null })
  const thumb = face ? thumbnailView(face) : null

  // Only the latest load of this face may touch the slot state.
  const latest = useRef(0)

  async function load(file: File | undefined) {
    if (!file) return
    const id = ++latest.current
    setProcessing(true)
    setError(null)
    let message: string | null = null
    try {
      const result = await pipeline.ingest(faceId, file)
      if (!result.ok && result.reason !== 'superseded') {
        message = result.reason === 'not-image' ? strings.loadStep.notImage : strings.loadStep.genericError
      }
    } catch {
      message = strings.loadStep.genericError
    }
    if (id !== latest.current) return
    setError(message)
    setProcessing(false)
  }

  const loadRef = useRef(load)
  loadRef.current = load
  useEffect(() => {
    if (!pasteTarget) return
    const onPaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'))
      if (!file) return
      event.preventDefault()
      void loadRef.current(file)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [pasteTarget])

  function takePhoto() {
    if (liveCamera) setCameraOpen(true)
    else cameraRef.current?.click()
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    if (event.dataTransfer.files.length > 0) void load(event.dataTransfer.files[0])
  }

  return (
    <section
      className="face-slot"
      data-status={status}
      data-dragging={dragging}
      data-face={faceId}
      aria-label={label}
      onFocus={() => onFocusFace(faceId)}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <h2 className="face-title visually-hidden">{label}</h2>
      <button
        type="button"
        className="face-area"
        aria-label={strings.loadStep.faceAreaLabel(label, strings.loadStep.faceStates[status])}
        onClick={() => galleryRef.current?.click()}
      >
        {thumb && thumb.kind !== 'loading' && (
          <Thumbnail bitmap={thumb.bitmap} label={strings.loadStep.thumbnailLabel(label)} />
        )}
        {thumb?.kind === 'loading' && (
          <span className="face-thumb face-thumb-loading" role="img" aria-label={strings.loadStep.thumbnailLoading(label)} />
        )}
        {!face && <span className="face-placeholder" aria-hidden="true">{strings.loadStep.addSymbol}</span>}
        <span className="face-text">
          <span className="face-name" aria-hidden="true">{label}</span>
          {face && status === 'loaded' && <span className="face-badge" aria-hidden="true">{strings.loadStep.ready}</span>}
          <span className="face-status" role="status">
            {status === 'processing' && strings.loadStep.processing}
            {status === 'loaded' && strings.loadStep.loaded(label)}
            {status === 'empty' && strings.loadStep.missing}
            {status === 'error' && error}
          </span>
          <span className="face-hint">{face ? strings.loadStep.replaceHint : liveCamera ? strings.loadStep.dropHintDesktop : strings.loadStep.dropHint}</span>
        </span>
      </button>
      {face && status === 'loaded' && isBlurry(face.sharpness) && (
        <div className="face-warning">
          <p role="status">{strings.photoWarnings.blurry}</p>
          <button type="button" className="face-action" onClick={hasCamera ? takePhoto : () => galleryRef.current?.click()}>
            {strings.photoWarnings.retake}
          </button>
        </div>
      )}
      <div className="face-actions">
        <button type="button" className="face-action" onClick={() => galleryRef.current?.click()}>
          <Icon d="M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4" />
          {strings.loadStep.pickFromGallery}
        </button>
        {hasCamera && (
          <button type="button" className="face-action" onClick={takePhoto}>
            <Icon d="M4 8h4l2-3h4l2 3h4v11H4zM12 11a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
            {strings.loadStep.takePhoto}
          </button>
        )}
      </div>
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        hidden
        data-testid={`${faceId}-gallery`}
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          void load(file)
        }}
      />
      {cameraOpen && (
        <CameraDialog
          onClose={(file) => {
            setCameraOpen(false)
            void load(file ?? undefined)
          }}
        />
      )}
      {hasCamera && !liveCamera && (
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          data-testid={`${faceId}-camera`}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            void load(file)
          }}
        />
      )}
    </section>
  )
}

export function LoadStep() {
  const profileId = useSession((s) => s.profileId)
  const hasCamera = useHasCamera()
  const faces = useSession((s) => s.faces)
  const [focused, setFocused] = useState('front' as FaceId)
  // A pasted image goes to the first empty face; with both loaded, to the one that has focus.
  const pasteFace: FaceId = !faces.front ? 'front' : !faces.back ? 'back' : focused
  return (
    <div className="load-step">
      <label className="load-field">
        <span className="load-field-label">{strings.loadStep.documentLabel}</span>
        <select
          className="load-select"
          value={profileId}
          onChange={(e) => void pipeline.setProfile(e.target.value)}
        >
          {PROFILES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      {FACE_IDS.map((id) => (
        <FaceSlot key={id} faceId={id} hasCamera={hasCamera} pasteTarget={pasteFace === id} onFocusFace={setFocused} />
      ))}
      <p className="load-privacy">{strings.loadStep.privacyNotice(isDesktop(currentNavigator()))}</p>
    </div>
  )
}
