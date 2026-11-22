import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Text-level guard against regressions in the workflow (no YAML parser on purpose: no new dependencies).
const workflow = readFileSync(join(import.meta.dirname, '..', '..', '.github', 'workflows', 'deploy.yml'), 'utf8')

/** Top-level section (`name:` at column 0) up to the next top-level key. */
function topLevel(name: string): string {
  const match = new RegExp(`^${name}:.*\\n((?:[ \\t]+.*\\n|\\s*\\n)*)`, 'm').exec(workflow)
  if (!match) throw new Error(`Falta la sección ${name}`)
  return match[0]
}

/** A job's block under `jobs:` (2-space indented key) up to the next job. */
function job(name: string): string {
  const jobs = topLevel('jobs')
  const match = new RegExp(`^  ${name}:.*\\n((?:    .*\\n|\\s*\\n)*)`, 'm').exec(jobs)
  if (!match) throw new Error(`Falta el job ${name}`)
  return match[0]
}

/** The YAML step (`- …` list item) that contains `needle`. */
function stepWith(block: string, needle: string): string {
  const step = block.split(/^(?=\s*- )/m).find((chunk) => chunk.includes(needle))
  if (!step) throw new Error(`Falta un step con ${needle}`)
  return step
}

const PUSH_TO_MAIN = /if: (matrix\.engine == 'cardfit' && )?github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/

describe('.github/workflows/deploy.yml', () => {
  it('runs the checks for each detection engine and publishes only cardfit', () => {
    const checks = job('checks')
    expect(checks).toMatch(/^ {8}engine: \[cardfit, scanic, opencv\]$/m)
    expect(checks).toContain('VITE_DETECTION_ENGINE: ${{ matrix.engine }}')
    expect(stepWith(checks, 'actions/upload-pages-artifact@v5')).toContain("matrix.engine == 'cardfit'")
  })

  it('runs on push to main and on pull requests', () => {
    const on = topLevel('on')
    expect(on).toMatch(/^ {2}push:\n {4}branches: \[main\]$/m)
    expect(on).toMatch(/^ {2}pull_request:/m)
  })

  it('runs the checks in order on a single build', () => {
    const checks = job('checks')
    const commands = [
      'npm ci',
      'npx playwright install --with-deps',
      'npm run lint',
      'npm run test',
      'npm run check:licenses',
      'npm run build',
      'npm run check:dist',
      'npm run check:engine',
      'npx playwright test',
    ]
    const positions = commands.map((command) => checks.indexOf(`run: ${command}\n`))
    for (const [index, command] of commands.entries()) expect(positions[index], command).toBeGreaterThan(-1)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    expect(checks.match(/run: npm run build\b/g)).toHaveLength(1)
    expect(workflow).not.toContain('test:e2e')
  })

  it('uploads the Playwright report only when the e2e fails', () => {
    const upload = stepWith(job('checks'), 'actions/upload-artifact@v7')
    expect(upload).toContain("if: failure() && steps.e2e.outcome == 'failure'")
    expect(upload).toContain('path: playwright-report/')
  })

  it('uploads dist/ to Pages only on push to main', () => {
    const upload = stepWith(job('checks'), 'actions/upload-pages-artifact@v5')
    expect(upload).toMatch(PUSH_TO_MAIN)
    expect(upload).toContain('path: dist')
  })

  it('uploads to Pages only after the e2e passed on that same build', () => {
    const checks = job('checks')
    const e2e = checks.indexOf('run: npx playwright test\n')
    expect(e2e).toBeGreaterThan(-1)
    expect(checks.indexOf('uses: actions/upload-pages-artifact@v5')).toBeGreaterThan(e2e)
  })

  it('serializes runs per ref and only cancels stale pull request runs', () => {
    expect(topLevel('concurrency').trimEnd() + '\n').toBe(
      'concurrency:\n' +
        '  group: ${{ github.workflow }}-${{ github.ref }}\n' +
        "  cancel-in-progress: ${{ github.event_name == 'pull_request' }}\n",
    )
    expect(job('checks')).toMatch(/^ {4}timeout-minutes: \d+$/m)
    expect(job('deploy')).toMatch(/^ {4}timeout-minutes: \d+$/m)
  })

  it('deploys only on push to main, after the checks', () => {
    const deploy = job('deploy')
    expect(deploy).toMatch(/^ {4}needs: checks$/m)
    expect(deploy).toMatch(PUSH_TO_MAIN)
    expect(deploy).toContain('uses: actions/deploy-pages@v5')
    expect(deploy).toMatch(/^ {6}name: github-pages$/m)
    expect(deploy).toContain('url: ${{ steps.deployment.outputs.page_url }}')
    expect(deploy).toContain('cancel-in-progress: false')
  })

  it('grants pages and id-token write only to the deploy job', () => {
    expect(topLevel('permissions')).toMatch(/^permissions:\n {2}contents: read\n/)
    const deploy = job('deploy')
    expect(deploy).toMatch(/^ {6}pages: write$/m)
    expect(deploy).toMatch(/^ {6}id-token: write$/m)
    const outsideDeploy = workflow.replace(deploy, '')
    expect(outsideDeploy).not.toMatch(/pages: write|id-token: write/)
  })

  it('builds with the repo variable VITE_BASE or /<repo>/', () => {
    expect(topLevel('env')).toContain(
      "VITE_BASE: ${{ vars.VITE_BASE || format('/{0}/', github.event.repository.name) }}",
    )
  })

  it('pins the actions to their current majors', () => {
    for (const action of [
      'actions/checkout@v7',
      'actions/setup-node@v7',
      'actions/upload-pages-artifact@v5',
      'actions/deploy-pages@v5',
      'actions/upload-artifact@v7',
    ]) {
      expect(workflow).toContain(`uses: ${action}`)
    }
    expect(stepWith(job('checks'), 'actions/setup-node@v7')).toMatch(/node-version: 24[\s\S]*cache: npm/)
  })
})
