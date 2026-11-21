// Pure logic for `npm run compare-engines`: no browser, no file system.
export type Pt = [number, number]
export type QuadJson = [Pt, Pt, Pt, Pt]

export const DEFAULT_ENGINE = 'scanic'
export const ENGINE_IDS = ['scanic', 'opencv'] as const
export type EngineName = (typeof ENGINE_IDS)[number]

export type EngineOutcome =
  | { status: 'ok'; detected: boolean; ms: number; error: number | null }
  | { status: 'engine-error' }

/** One anonymous image: outcomes by engine. The index is its position in the list. */
export type ImageResult = Record<EngineName, EngineOutcome>

export type ReportSource = 'corpus' | 'fixtures'

/** Mean Euclidean distance (px) between corresponding corners; null when either quad is malformed. */
export function meanCornerError(a: readonly Pt[], b: readonly Pt[]): number | null {
  if (a.length !== 4 || b.length !== 4) return null
  let sum = 0
  for (let i = 0; i < 4; i++) {
    const d = Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1])
    if (!Number.isFinite(d)) return null
    sum += d
  }
  return sum / 4
}

/** Parses a `<name>.quad.json` body (`[[x,y]x4]`); null when invalid. */
export function parseQuadJson(text: string): QuadJson | null {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return null
  }
  if (!Array.isArray(value) || value.length !== 4) return null
  for (const p of value) {
    if (!Array.isArray(p) || p.length !== 2 || !p.every((n) => typeof n === 'number' && Number.isFinite(n))) return null
  }
  return value as QuadJson
}

export interface EngineSummary {
  engine: EngineName
  images: number
  detected: number
  engineErrors: number
  meanMs: number | null
  /** Mean of per-image errors, only over detections with ground truth. */
  meanErrorPx: number | null
  withGroundTruth: number
}

const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)

export function summarize(results: readonly ImageResult[]): EngineSummary[] {
  return ENGINE_IDS.map((engine) => {
    const ok = results.map((r) => r[engine]).filter((o) => o.status === 'ok')
    const errors = ok.flatMap((o) => (o.detected && o.error !== null ? [o.error] : []))
    return {
      engine,
      images: results.length,
      detected: ok.filter((o) => o.detected).length,
      engineErrors: results.length - ok.length,
      meanMs: mean(ok.map((o) => o.ms)),
      meanErrorPx: mean(errors),
      withGroundTruth: errors.length,
    }
  })
}

const fmt = (n: number | null, digits = 1): string => (n === null ? '—' : n.toFixed(digits))

function cell(o: EngineOutcome): string[] {
  if (o.status === 'engine-error') return ['error de motor', '—', '—']
  return [o.detected ? 'sí' : 'no', fmt(o.ms), o.detected ? fmt(o.error) : '—']
}

/** Plain-text Markdown report. Images are only identified by `imagen 1…n`: no names, paths or pixels. */
export function renderReport(results: readonly ImageResult[], source: ReportSource, date: string): string {
  const sourceLabel = source === 'corpus' ? 'corpus (fotos reales, no incluidas en el repo)' : 'fixtures (imágenes sintéticas)'
  const lines = [
    '# Comparación de motores de detección',
    '',
    `Fecha: ${date}`,
    `Fuente de imágenes: ${sourceLabel}`,
    `Imágenes: ${results.length}`,
    ...(source === 'fixtures' ? ['', '> Aviso: son imágenes sintéticas; los números no son representativos y no sirven para decidir el motor. Corré el script con fotos reales en `corpus/`.', ''] : []),
    `Valor por defecto de \`VITE_DETECTION_ENGINE\`: \`${DEFAULT_ENGINE}\``,
    '',
    'Cada imagen se reduce como en el worker (lado mayor ≤ 1024 px, orientada por EXIF) y el cuadrilátero se reescala a px de la fuente antes de medir el error. El error es la media de la distancia entre esquinas contra `<nombre>.quad.json`; «—» significa sin dato.',
    '',
    '## Resumen',
    '',
    '| Motor | Detecciones | Errores de motor | Tiempo medio (ms) | Error medio (px) | Imágenes con verdad terreno |',
    '| --- | --- | --- | --- | --- | --- |',
    ...summarize(results).map(
      (s) => `| ${s.engine} | ${s.detected}/${s.images} | ${s.engineErrors} | ${fmt(s.meanMs)} | ${fmt(s.meanErrorPx)} | ${s.withGroundTruth} |`,
    ),
    '',
    '## Detalle por imagen',
    '',
    `| Imagen | ${ENGINE_IDS.map((e) => `${e}: detectó | ${e}: ms | ${e}: error (px)`).join(' | ')} |`,
    `| --- | ${ENGINE_IDS.map(() => '--- | --- | ---').join(' | ')} |`,
    ...results.map((r, i) => `| imagen ${i + 1} | ${ENGINE_IDS.flatMap((e) => cell(r[e])).join(' | ')} |`),
    '',
    '## Decisión',
    '',
    'Motor elegido: _por completar_',
    '',
    'Motivo: _por completar_',
    '',
  ]
  return lines.join('\n')
}
