// Orientation rule over the real, hand-annotated corpus (outside git: skipped when `corpus/orientation.json` is missing).
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runOrientationCorpus } from '../../scripts/compare-engines-runner.ts'

const root = resolve(import.meta.dirname, '..', '..')
const present = existsSync(join(root, 'corpus', 'orientation.json'))

const MIN_HITS = 22
const MAX_MS = 100

describe.skipIf(!present)('orientation corpus', () => {
  it('gets the annotated rotation, never upside down when the signal is clear, in < 100 ms', { timeout: 240_000 }, async () => {
    const rows = await runOrientationCorpus(root)
    expect(rows).not.toBeNull()
    const all = rows!
    expect(all.length).toBeGreaterThanOrEqual(24)
    expect(all.every((r) => r.rotation !== null)).toBe(true)
    const hits = all.filter((r) => r.rotation === r.expected).length
    expect(hits).toBeGreaterThanOrEqual(MIN_HITS)
    const upsideDown = all.filter((r) => r.decidedBy === 'content' && r.rotation === (r.expected + 180) % 360)
    expect(upsideDown).toEqual([])
    // Doubtful ones still land on the right axis.
    expect(all.filter((r) => (r.rotation! % 180) !== (r.expected % 180))).toEqual([])
    const slow = all.filter((r) => r.ms! > MAX_MS)
    expect(slow).toEqual([])
  })
})
