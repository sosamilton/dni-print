import { describe, expect, it } from 'vitest'
import { meanCornerError, parseQuadJson, renderReport, summarize } from '../../scripts/compare-engines-lib.ts'
import type { ImageResult } from '../../scripts/compare-engines-lib.ts'

const ok = (detected: boolean, ms: number, error: number | null) => ({ status: 'ok' as const, detected, ms, error })

describe('meanCornerError', () => {
  it('averages corner distances', () => {
    expect(meanCornerError([[0, 0], [1, 0], [1, 1], [0, 1]], [[3, 4], [1, 0], [1, 1], [0, 1]])).toBe(1.25)
  })
  it('rejects malformed input', () => {
    expect(meanCornerError([[0, 0]], [[0, 0]])).toBeNull()
  })
})

describe('parseQuadJson', () => {
  it('accepts a valid quad and ignores invalid json', () => {
    expect(parseQuadJson('[[0,0],[1,0],[1,1],[0,1]]')).not.toBeNull()
    expect(parseQuadJson('nope')).toBeNull()
    expect(parseQuadJson('[[0,0],[1,0],[1,1]]')).toBeNull()
    expect(parseQuadJson('[[0,0],[1,0],[1,1],["a",1]]')).toBeNull()
  })
})

const results: ImageResult[] = [
  { scanic: ok(true, 10, 2), opencv: { status: 'engine-error' } },
  { scanic: ok(false, 20, null), opencv: { status: 'engine-error' } },
]

describe('summarize', () => {
  it('excludes misses and engine errors from the error mean', () => {
    const [scanic, opencv] = summarize(results)
    expect(scanic).toMatchObject({ detected: 1, meanErrorPx: 2, meanMs: 15, withGroundTruth: 1 })
    expect(opencv).toMatchObject({ engineErrors: 2, meanMs: null, meanErrorPx: null })
  })
})

describe('renderReport', () => {
  const text = renderReport(results, 'fixtures', '2026-01-01')
  it('uses anonymous indexes, has an empty Decision and names scanic as default', () => {
    expect(text).toContain('imagen 1')
    expect(text).toContain('imagen 2')
    expect(text).toContain('## Decisión')
    expect(text).toContain('por completar')
    expect(text).toContain('`scanic`')
    expect(text).toContain('error de motor')
    expect(text).not.toMatch(/\.(png|jpe?g|webp)|\.quad\.json\b.*\/|\/home|!\[/)
  })
})
