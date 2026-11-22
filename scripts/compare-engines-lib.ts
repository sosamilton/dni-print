// Pure logic for `npm run compare-engines`: no browser, no file system.
export type Pt = [number, number]
export type QuadJson = [Pt, Pt, Pt, Pt]

export const DEFAULT_ENGINE = 'cardfit'
export const ENGINE_IDS = ['cardfit', 'scanic', 'opencv'] as const

/** A detection with a mean corner error below this is a «acierto»; at or above it is a gross error (counts as a miss). */
export const HIT_ERROR_PX = 100
export type EngineName = (typeof ENGINE_IDS)[number]

export type EngineOutcome =
  | { status: 'ok'; detected: boolean; ms: number; error: number | null; refinedError: number | null }
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
  /** Same, after the full-resolution corner refinement. */
  meanRefinedErrorPx: number | null
  withGroundTruth: number
  /** Median of the refined (production) error over detections with ground truth. */
  medianRefinedErrorPx: number | null
  /** Detections whose refined error is below `HIT_ERROR_PX`. */
  hits: number
  /** Detections whose refined error is `HIT_ERROR_PX` or more. */
  gross: number
}

const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)

export function median(xs: readonly number[]): number | null {
  if (!xs.length) return null
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function summarize(results: readonly ImageResult[]): EngineSummary[] {
  return ENGINE_IDS.map((engine) => {
    const ok = results.map((r) => r[engine]).filter((o) => o.status === 'ok')
    const errors = ok.flatMap((o) => (o.detected && o.error !== null ? [o.error] : []))
    const refinedErrors = ok.flatMap((o) => (o.detected && o.refinedError !== null ? [o.refinedError] : []))
    return {
      engine,
      images: results.length,
      detected: ok.filter((o) => o.detected).length,
      engineErrors: results.length - ok.length,
      meanMs: mean(ok.map((o) => o.ms)),
      meanErrorPx: mean(errors),
      meanRefinedErrorPx: mean(refinedErrors),
      withGroundTruth: errors.length,
      medianRefinedErrorPx: median(refinedErrors),
      hits: refinedErrors.filter((e) => e < HIT_ERROR_PX).length,
      gross: refinedErrors.filter((e) => e >= HIT_ERROR_PX).length,
    }
  })
}

const fmt = (n: number | null, digits = 1): string => (n === null ? '—' : n.toFixed(digits))

function cell(o: EngineOutcome): string[] {
  if (o.status === 'engine-error') return ['error de motor', '—', '—', '—']
  return [o.detected ? 'sí' : 'no', fmt(o.ms), o.detected ? fmt(o.error) : '—', o.detected ? fmt(o.refinedError) : '—']
}

const DECISION_PLACEHOLDER = '## Decisión\n\nMotor elegido: _por completar_\n\nMotivo: _por completar_'

/** The «Decisión» section (heading included, up to the next `## ` or the end) of an earlier report; null when absent or still a placeholder. */
export function extractDecision(report: string): string | null {
  const start = report.search(/^## Decisión\s*$/m)
  if (start < 0) return null
  const rest = report.slice(start)
  const next = rest.slice(1).search(/^## /m)
  const section = (next < 0 ? rest : rest.slice(0, next + 1)).trim()
  return /^Motor elegido: _por completar_\s*$/m.test(section) ? null : section
}

/** Plain-text Markdown report. Images are only identified by `imagen 1…n`: no names, paths or pixels. */
export function renderReport(results: readonly ImageResult[], source: ReportSource, date: string, decision?: string): string {
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
    'Cada imagen se reduce como en el worker (lado mayor ≤ 1024 px, orientada por EXIF) y el cuadrilátero se reescala a px de la fuente antes de medir el error. El «error refinado» se mide después de ajustar las esquinas sobre la imagen a resolución completa (`refineQuad`), como hace el worker; si el refinado no es confiable, conserva el cuadrilátero sin refinar. El error es la media de la distancia entre esquinas contra `<nombre>.quad.json`; «—» significa sin dato.',
    '',
    '## Resumen',
    '',
    `Pipeline de producción = detección + refinado a resolución completa. Un «acierto» es una detección con error refinado menor a ${HIT_ERROR_PX} px; una detección con ${HIT_ERROR_PX} px o más es un error grosero y cuenta como fallo, igual que no detectar.`,
    '',
    '| Motor | Aciertos | Errores groseros | Mediana del error refinado (px) | Detecciones | Errores de motor | Tiempo medio (ms) | Error medio (px) | Error refinado medio (px) | Imágenes con verdad terreno |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...summarize(results).map(
      (s) =>
        `| ${s.engine} | ${s.hits}/${s.images} | ${s.gross} | ${fmt(s.medianRefinedErrorPx)} | ${s.detected}/${s.images} | ${s.engineErrors} | ${fmt(s.meanMs)} | ${fmt(s.meanErrorPx)} | ${fmt(s.meanRefinedErrorPx)} | ${s.withGroundTruth} |`,
    ),
    '',
    '## Detalle por imagen',
    '',
    `| Imagen | ${ENGINE_IDS.map((e) => `${e}: detectó | ${e}: ms | ${e}: error (px) | ${e}: error refinado (px)`).join(' | ')} |`,
    `| --- | ${ENGINE_IDS.map(() => '--- | --- | --- | ---').join(' | ')} |`,
    ...results.map((r, i) => `| imagen ${i + 1} | ${ENGINE_IDS.flatMap((e) => cell(r[e])).join(' | ')} |`),
    '',
    decision?.trim() ? decision.trim() : DECISION_PLACEHOLDER,
    '',
  ]
  return lines.join('\n')
}
