import react from '@vitejs/plugin-react'
import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import { gitFromCli, resolveBase, resolveBuildInfo } from './scripts/build-info.ts'

const CSP_META = /[ \t]*<meta\b[^>]*http-equiv=["']?Content-Security-Policy["']?[^>]*>\r?\n?/i

/**
 * Removes the CSP meta only in `vite` dev: React Refresh injects an inline
 * preamble that the policy forbids. `vite build` and `vite preview` keep it.
 */
export function stripCspInDev(): Plugin {
  return {
    name: 'strip-csp-in-dev',
    apply: 'serve',
    transformIndexHtml: (html) => html.replace(CSP_META, ''),
  }
}

/**
 * scanic lazy-loads an ML chunk that points at cdn.jsdelivr.net. We only use the
 * classical detector, so replace the chunk with an inert stub (no external URL in dist/).
 */
export function stubScanicMl(): Plugin {
  return {
    name: 'stub-scanic-ml',
    enforce: 'pre',
    load(id) {
      if (/scanic-mlDetector\.js(\?.*)?$/.test(id)) {
        return 'const off = async () => { throw new Error("scanic ML detector is disabled") }\nexport { off as detectDocumentMl, off as initializeMl }\n'
      }
      return null
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // `.env*` files fill in what the real environment does not set.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const base = resolveBase(env.VITE_BASE)
  const buildInfo = resolveBuildInfo(env, gitFromCli())
  console.info(`[build-info] sha=${buildInfo.sha ?? 'none'} repoUrl=${buildInfo.repoUrl ?? 'none'} base=${base}`)

  return {
    base,
    // Like GitHub Pages, answer missing files with 404 instead of the SPA index.html,
    // so the e2e guard sees assets requested outside the base. Navigation is state-only.
    appType: 'mpa',
    plugins: [react(), stripCspInDev(), stubScanicMl()],
    worker: { format: 'es', plugins: () => [stubScanicMl()] },
    define: {
      __COMMIT_SHA__: JSON.stringify(buildInfo.sha),
      __REPO_URL__: JSON.stringify(buildInfo.repoUrl),
    },
    test: {
      include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
      exclude: ['tests/e2e/**', 'node_modules/**'],
    },
  }
})
