import { useState } from 'react'
import { isBlurry, validateQuad } from '../core/index.ts'
import type { FaceId } from '../worker/api.ts'
import { BitmapCanvas } from './bitmap-canvas.tsx'
import { CornerEditor } from './corner-editor.tsx'
import { isLowResolution, nextRotation } from './corner-editor-model.ts'
import { pipeline } from './pipeline.ts'
import { useSession } from './session-store.ts'
import { strings } from './strings.es.ts'
import './crop-step.css'

const CROP_ORDER: readonly FaceId[] = ['front', 'back']

function FaceChips({ faceId }: { faceId: FaceId }) {
  const copy = strings.cropStep
  return (
    <ul className="crop-faces" aria-label={copy.faceSelectorLabel}>
      {CROP_ORDER.map((id) => (
        <li key={id} className="crop-face-chip" data-current={id === faceId} aria-current={id === faceId ? 'step' : undefined}>
          {strings.loadStep.faces[id]}
          <span className="crop-face-state">{id === 'front' && faceId === 'back' ? copy.faceDone : copy.facePending}</span>
        </li>
      ))}
    </ul>
  )
}

export function CropStep({ faceId }: { faceId: FaceId }) {
  const face = useSession((s) => s.faces[faceId])
  const [adjusting, setAdjusting] = useState(false)
  if (!face) return null
  const index = CROP_ORDER.indexOf(faceId) + 1
  const valid = validateQuad(face.quad)
  const copy = strings.cropStep
  const blurry = isBlurry(face.sharpness) && (
    <p className="crop-message" data-kind="warning" role="status">
      {strings.photoWarnings.blurry}
    </p>
  )

  if (face.quadOrigin === 'auto' && !adjusting) {
    return (
      <div className="crop-step">
        <FaceChips faceId={faceId} />
        <p className="crop-counter">{copy.faceCounter(strings.loadStep.faces[faceId], index, CROP_ORDER.length)}</p>
        {face.rendered && valid && (
          <BitmapCanvas bitmap={face.rendered} label={copy.resultLabel} className="crop-result" />
        )}
        {face.rendered && valid && <p className="crop-detected">{copy.detected}</p>}
        {!face.rendered && <p role="status">{strings.loadStep.processing}</p>}
        {blurry}
        <div className="crop-actions">
          <button type="button" className="crop-action" onClick={() => setAdjusting(true)}>
            {copy.adjust}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="crop-step">
      <p className="crop-counter">{copy.faceCounter(strings.loadStep.faces[faceId], index, CROP_ORDER.length)}</p>
      <p className="crop-instruction">{face.quadOrigin === 'default' ? copy.notFound : copy.instruction}</p>
      <CornerEditor face={face} onCommit={(quad) => void pipeline.setQuad(faceId, quad)} />
      {!valid && (
        <p className="crop-message" data-kind="error" role="alert">
          {copy.invalid}
        </p>
      )}
      {isLowResolution(face.quad, face.rotation) && (
        <p className="crop-message" data-kind="warning" role="status">
          {copy.lowResolution}
        </p>
      )}
      {blurry}
      <div className="crop-actions">
        <button type="button" className="crop-action" onClick={() => void pipeline.setRotation(faceId, nextRotation(face.rotation))}>
          {copy.rotate}
        </button>
        <button type="button" className="crop-action" onClick={() => void pipeline.resetQuad(faceId)}>
          {copy.reset}
        </button>
      </div>
      {face.rendered && valid && (
        <BitmapCanvas bitmap={face.rendered} label={copy.resultLabel} className="crop-result" />
      )}
    </div>
  )
}
