import { describe, expect, it } from 'vitest'
import { faceReviewState, markReviewed, nextPendingFace, reviewSignature, type ReviewableFace } from '../../src/ui/crop-review-model.ts'

const quad = (n: number) => [{ x: n, y: n }, { x: n + 10, y: n }, { x: n + 10, y: n + 10 }, { x: n, y: n + 10 }] as ReviewableFace['quad']
const face = (n: number, rotation: 0 | 90 = 0): ReviewableFace => ({ quad: quad(n), rotation })

describe('crop review model', () => {
  it('starts pending and becomes reviewed when marked', () => {
    expect(faceReviewState({}, 'front', face(1))).toBe('pending')
    expect(faceReviewState(markReviewed({}, 'front', face(1)), 'front', face(1))).toBe('reviewed')
  })
  it('a missing face is pending', () => {
    expect(faceReviewState(markReviewed({}, 'front', face(1)), 'front', undefined)).toBe('pending')
  })
  it('editing quad or rotation makes a reviewed face pending again', () => {
    const reviews = markReviewed({}, 'front', face(1))
    expect(faceReviewState(reviews, 'front', face(2))).toBe('pending')
    expect(faceReviewState(reviews, 'front', face(1, 90))).toBe('pending')
  })
  it('does not touch the other face', () => {
    const reviews = markReviewed({}, 'front', face(1))
    expect(faceReviewState(reviews, 'back', face(1))).toBe('pending')
  })
  it('nextPendingFace goes to the other pending face, or null with both reviewed', () => {
    const faces = { front: face(1), back: face(2) }
    const front = markReviewed({}, 'front', faces.front)
    expect(nextPendingFace(front, faces, 'front')).toBe('back')
    expect(nextPendingFace({}, faces, 'back')).toBe('front')
    expect(nextPendingFace(markReviewed(front, 'back', faces.back), faces, 'back')).toBeNull()
  })
  it('signature differs per quad', () => {
    expect(reviewSignature(face(1))).not.toBe(reviewSignature(face(2)))
  })
})
