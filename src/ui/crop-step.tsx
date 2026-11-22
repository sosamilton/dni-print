import { useState } from 'react'
import { isBlurry, validateQuad } from '../core/index.ts'
import type { FaceId } from '../worker/api.ts'
import { BitmapCanvas } from './bitmap-canvas.tsx'
import { CornerEditor } from './corner-editor.tsx'
import { isLowResolution, nextRotation } from './corner-editor-model.ts'
import { CROP_ORDER, faceReviewState, type Reviews, type ReviewState } from './crop-review-model.ts'
import { pipeline } from './pipeline.ts'
import { useSession } from './session-store.ts'
import { strings } from './strings.es.ts'
import './crop-step.css'

interface FaceChipsProps {
  faceId: FaceId
  reviews: Reviews
  /** Present from 900px: the chips become buttons with a thumbnail. */
  onSelect?: (id: FaceId) => void
}

function ChipBody({ id, state, thumb }: { id: FaceId; state: ReviewState; thumb: boolean }) {
  const copy = strings.cropStep
  const face = useSession((s) => s.faces[id])
  const name = strings.loadStep.faces[id]
  return (
    <>
      {thumb && face && <BitmapCanvas bitmap={face.previewBitmap} label={copy.thumbnailLabel(name)} className="crop-face-thumb" />}
      <span className="crop-face-name">{name}</span>
      <span className="crop-face-state" data-state={state}>{state === 'reviewed' ? copy.faceDone : copy.facePending}</span>
    </>
  )
}

function FaceChip({ id, current, state, onSelect }: { id: FaceId; current: boolean; state: ReviewState; onSelect?: (id: FaceId) => void }) {
  return (
    <li className="crop-face-chip" data-current={current} data-state={state} aria-current={current ? 'step' : undefined}>
      {onSelect && (
        <button type="button" className="crop-face-button" onClick={() => onSelect(id)}>
          <ChipBody id={id} state={state} thumb />
        </button>
      )}
      {!onSelect && <ChipBody id={id} state={state} thumb={false} />}
    </li>
  )
}

export function FaceChips({ faceId, reviews, onSelect }: FaceChipsProps) {
  const faces = useSession((s) => s.faces)
  return (
    <ul className="crop-faces" aria-label={strings.cropStep.faceSelectorLabel}>
      {CROP_ORDER.map((id) => (
        <FaceChip key={id} id={id} current={id === faceId} state={faceReviewState(reviews, id, faces[id])} onSelect={onSelect} />
      ))}
    </ul>
  )
}

export interface CropStepProps {
  faceId: FaceId
  reviews: Reviews
  /** Present from 900px: lets the chips pick the face. */
  onSelectFace?: (id: FaceId) => void
}

export function CropStep({ faceId, reviews, onSelectFace }: CropStepProps) {
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
        <FaceChips faceId={faceId} reviews={reviews} onSelect={onSelectFace} />
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
      {onSelectFace && <FaceChips faceId={faceId} reviews={reviews} onSelect={onSelectFace} />}
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
