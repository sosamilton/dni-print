import { describe, expect, it } from 'vitest'
import { engineProblems } from '../../scripts/check-dist-engine.ts'

describe('engineProblems', () => {
  it('scanic build: OK without an OpenCV chunk, flags one', () => {
    expect(engineProblems('scanic', { 'index-a.js': 'scanDocument' })).toEqual([])
    expect(engineProblems('scanic', { 'opencv-a.js': '' })).toHaveLength(1)
  })
  it('opencv build: needs the OpenCV chunk and no scanic', () => {
    expect(engineProblems('opencv', { 'opencv-a.js': '', 'index-a.js': 'x' })).toEqual([])
    expect(engineProblems('opencv', { 'index-a.js': 'x' })).toHaveLength(1)
    expect(engineProblems('opencv', { 'opencv-a.js': '', 'w.js': 'scanDocument(' })).toHaveLength(1)
    expect(engineProblems('opencv', { 'opencv-a.js': '', 'scanic-mlDetector-a.js': '' })).toHaveLength(1)
  })
})
