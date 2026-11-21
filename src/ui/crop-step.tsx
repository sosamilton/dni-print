import { validateQuad } from '../core/index.ts'
import type { FaceId } from '../worker/api.ts'
import { BitmapCanvas } from './bitmap-canvas.tsx'
import { CornerEditor } from './corner-editor.tsx'
import { isLowResolution, nextRotation } from './corner-editor-model.ts'
import { pipeline } from './pipeline.ts'
import { useSession } from './session-store.ts'
import { strings } from './strings.es.ts'
import './crop-step.css'

const CROP_ORDER: readonly FaceId[] = ['front', 'back']

export function CropStep({ faceId }: { faceId: FaceId }) {
  const face = useSession((s) => s.faces[faceId])
  if (!face) return null
  const index = CROP_ORDER.indexOf(faceId) + 1
  const valid = validateQuad(face.quad)
  const copy = strings.cropStep

  return (
    <div className="crop-step">
      <p className="crop-counter">{copy.faceCounter(strings.loadStep.faces[faceId], index, CROP_ORDER.length)}</p>
      <p className="crop-instruction">{copy.instruction}</p>
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
