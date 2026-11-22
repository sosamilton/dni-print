// Pure model of the crop step's per-face review state: no React, no DOM.
import type { Quad, Rotation } from '../core/index.ts'
import type { FaceId } from '../worker/api.ts'

export const CROP_ORDER: readonly FaceId[] = ['front', 'back']

export type ReviewState = 'reviewed' | 'pending'

/** Snapshot of what the user saw when validating a face: its quad and rotation. */
export type Reviews = Partial<Record<FaceId, string>>

export interface ReviewableFace {
  quad: Quad
  rotation: Rotation
}

export function reviewSignature(face: ReviewableFace): string {
  return JSON.stringify([face.quad, face.rotation])
}

/** A face is reviewed only while its quad and rotation equal the ones it was validated with. */
export function faceReviewState(reviews: Reviews, faceId: FaceId, face: ReviewableFace | undefined): ReviewState {
  const saved = reviews[faceId]
  return face !== undefined && saved !== undefined && saved === reviewSignature(face) ? 'reviewed' : 'pending'
}

export function markReviewed(reviews: Reviews, faceId: FaceId, face: ReviewableFace): Reviews {
  return { ...reviews, [faceId]: reviewSignature(face) }
}

/** After validating `current`: the other face still pending (in order), or null when both are reviewed. */
export function nextPendingFace(
  reviews: Reviews,
  faces: Partial<Record<FaceId, ReviewableFace>>,
  current: FaceId,
): FaceId | null {
  const others = CROP_ORDER.filter((id) => id !== current)
  return others.find((id) => faceReviewState(reviews, id, faces[id]) === 'pending') ?? null
}
