import { describe, expect, it } from 'vitest'
import { extractDecision, HIT_ERROR_PX, median, meanCornerError, parseQuadJson, renderReport, summarize } from '../../scripts/compare-engines-lib.ts'
import type { ImageResult } from '../../scripts/compare-engines-lib.ts'

const ok = (detected: boolean, ms: number, error: number | null, refinedError: number | null = null) => ({ status: 'ok' as const, detected, ms, error, refinedError })

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

const gone = { status: 'engine-error' as const }
const results: ImageResult[] = [
  { cardfit: ok(true, 10, 2, 0.5), scanic: ok(true, 10, 2, 0.5), opencv: gone },
  { cardfit: ok(false, 20, null), scanic: ok(false, 20, null), opencv: gone },
]

describe('summarize', () => {
  it('excludes misses and engine errors from the error mean', () => {
    const [, scanic, opencv] = summarize(results)
    expect(scanic).toMatchObject({ detected: 1, meanErrorPx: 2, meanRefinedErrorPx: 0.5, meanMs: 15, withGroundTruth: 1 })
    expect(opencv).toMatchObject({ engineErrors: 2, meanMs: null, meanErrorPx: null, meanRefinedErrorPx: null })
  })
})

describe('renderReport', () => {
  const text = renderReport(results, 'fixtures', '2026-01-01')
  it('uses anonymous indexes, has an empty Decision and names cardfit as default', () => {
    expect(text).toContain('imagen 1')
    expect(text).toContain('imagen 2')
    expect(text).toContain('## Decisión')
    expect(text).toContain('por completar')
    expect(text).toContain('`cardfit`')
    expect(text).toContain('error de motor')
  })
  it('reports the error with and without refinement', () => {
    expect(text).toContain('| Error medio (px) | Error refinado medio (px) |')
    expect(text).toContain('scanic: error (px) | scanic: error refinado (px)')
    expect(text).toContain('| imagen 1 | sí | 10.0 | 2.0 | 0.5 | sí | 10.0 | 2.0 | 0.5 | error de motor | — | — | — |')
    expect(text).not.toMatch(/\.(png|jpe?g|webp)|\.quad\.json\b.*\/|\/home|!\[/)
  })
})

describe('hits, gross errors and median', () => {
  const rows: ImageResult[] = [10, 30, 50, 99, 100, 700].map((e) => ({ cardfit: ok(true, 1, e, e), scanic: gone, opencv: gone }))
  rows.push({ cardfit: ok(false, 1, null), scanic: gone, opencv: gone })
  const [cardfit] = summarize(rows)

  it('counts a hit only below the threshold; a gross detection is a miss like no detection', () => {
    expect(HIT_ERROR_PX).toBe(100)
    expect(cardfit).toMatchObject({ hits: 4, gross: 2, detected: 6, images: 7 })
  })
  it('takes the median of the refined error over detections', () => {
    expect(cardfit.medianRefinedErrorPx).toBe(74.5)
    expect(median([])).toBeNull()
    expect(median([3, 1, 2])).toBe(2)
  })
  it('shows hits, gross errors and the median in the report summary', () => {
    const text = renderReport(rows, 'corpus', '2026-01-01')
    expect(text).toContain('| cardfit | 4/7 | 2 | 74.5 |')
  })
})

describe('Decisión section', () => {
  const written = '## Decisión\n\nMotor elegido: cardfit\n\nMotivo: mide mejor.'
  it('extractDecision returns a written section and ignores the placeholder', () => {
    expect(extractDecision(`# T\n\n## Resumen\n\nx\n\n${written}\n`)).toBe(written)
    expect(extractDecision('# T\n\n## Decisión\n\nMotor elegido: _por completar_\n')).toBeNull()
    expect(extractDecision('# T\n\n## Resumen\n')).toBeNull()
  })
  it('a new report keeps the written Decisión instead of overwriting it', () => {
    const text = renderReport(results, 'corpus', '2026-01-01', written)
    expect(text).toContain('Motor elegido: cardfit')
    expect(text).not.toContain('por completar')
    expect(text.match(/## Decisión/g)).toHaveLength(1)
  })
  it('keeps a written Decisión that mentions the placeholder text', () => {
    const d = '## Decisión\n\nMotor elegido: cardfit\n\nAntes decía _por completar_.'
    expect(extractDecision(d)).toBe(d)
  })
  it('stops at the next section', () => {
    expect(extractDecision(`${written}\n\n## Otro\n\ncosas`)).toBe(written)
  })
})
