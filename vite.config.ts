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
    plugins: [react(), stripCspInDev()],
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
