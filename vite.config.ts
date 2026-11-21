import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import { gitFromCli, resolveBuildInfo } from './scripts/build-info.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // `.env*` files fill in what the real environment does not set.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const buildInfo = resolveBuildInfo(env, gitFromCli())
  console.info(`[build-info] sha=${buildInfo.sha ?? 'none'} repoUrl=${buildInfo.repoUrl ?? 'none'}`)

  return {
    plugins: [react()],
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
