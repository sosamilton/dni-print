// Regression guard over the real, hand-annotated corpus (outside git: skipped when `corpus/` is missing, e.g. in CI).
// Runs the production pipeline (detection + full-resolution refinement) in Chromium, like `npm run compare-engines`.
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_ENGINE, summarize } from '../../scripts/compare-engines-lib.ts'
import { runComparison } from '../../scripts/compare-engines-runner.ts'

const root = resolve(import.meta.dirname, '..', '..')
const corpus = join(root, 'corpus')
const annotated = existsSync(corpus) ? readdirSync(corpus).filter((n) => n.endsWith('.quad.json')).length : 0

/** Floors a little under what the pipeline measures today (24/24 hits, median ~20 px): a worse number fails. */
const MIN_HITS_RATIO = 0.9
const MAX_MEDIAN_PX = 30
const MAX_GROSS = 1

describe.skipIf(annotated === 0)('corpus regression', () => {
  it(`the ${DEFAULT_ENGINE} pipeline keeps its hits and its median error`, { timeout: 240_000 }, async () => {
    const comparison = await runComparison(root)
    expect(comparison?.source).toBe('corpus')
    const summary = summarize(comparison!.results).find((s) => s.engine === DEFAULT_ENGINE)!
    expect(summary.withGroundTruth).toBeGreaterThan(0)
    expect(summary.hits).toBeGreaterThanOrEqual(Math.ceil(MIN_HITS_RATIO * summary.images))
    expect(summary.medianRefinedErrorPx!).toBeLessThanOrEqual(MAX_MEDIAN_PX)
    expect(summary.gross).toBeLessThanOrEqual(MAX_GROSS)
  })
})
