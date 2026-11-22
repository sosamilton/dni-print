import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import { canonicalUrl, gitFromCli, resolveBase, resolveBuildInfo, resolveSiteUrl } from './scripts/build-info.ts'

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

const JSON_LD_BLOCK = /[ \t]*<script\b[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>\r?\n?/gi
const SHARE_TAG_LINE = /^[ \t]*<(?:meta|link)\b[^>]*%(?:CANONICAL_URL|OG_IMAGE_URL)%[^>]*>\r?\n?/gm

/**
 * Rellena las etiquetas de vista previa de `index.html` con la URL canónica del build
 * (`%CANONICAL_URL%`, `%OG_IMAGE_URL%`). Sin sitio conocido quita esas etiquetas (nunca queda una URL inventada).
 */
export function sharePreview(canonical: string | null): Plugin {
  return {
    name: 'share-preview',
    transformIndexHtml: (html) => {
      if (!canonical) return html.replace(JSON_LD_BLOCK, '').replace(SHARE_TAG_LINE, '')
      return html
        .replaceAll('%CANONICAL_URL%', canonical)
        .replaceAll('%OG_IMAGE_URL%', `${canonical}og-image.png`)
    },
  }
}

/** Emite `robots.txt` y `sitemap.xml` con la URL canónica del build; sin sitio conocido no emite nada. */
export function seoFiles(canonical: string | null): Plugin {
  return {
    name: 'seo-files',
    generateBundle() {
      if (!canonical) return
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${canonical}sitemap.xml\n`,
      })
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${canonical}</loc></url>\n</urlset>\n`,
      })
    },
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

/** Engines that need `'unsafe-eval'` (OpenCV.js's emscripten glue uses `new Function`). */
const EVAL_ENGINES = new Set(['opencv'])
const KNOWN_ENGINES = new Set(['cardfit', 'scanic', 'opencv'])

/** Adds `'unsafe-eval'` to `script-src` of the CSP meta only for engines that need it; other builds keep AD-7 verbatim. */
export function engineCsp(engineId: string): Plugin {
  return {
    name: 'engine-csp',
    transformIndexHtml: (html) => {
      if (!EVAL_ENGINES.has(engineId)) return html
      const out = html.replace(/(script-src [^;"]*?'wasm-unsafe-eval')/, "$1 'unsafe-eval'")
      // Fail the build instead of shipping a CSP that would block OpenCV.js at runtime.
      if (out === html) throw new Error("engine-csp: script-src with 'wasm-unsafe-eval' not found in index.html")
      return out
    },
  }
}

/** PWA precache size limit (story 5.2 reuses it): OpenCV.js with embedded wasm is ~13 MB. */
export function precacheOptions(engineId: string): { maximumFileSizeToCacheInBytes: number } {
  return { maximumFileSizeToCacheInBytes: (engineId === 'opencv' ? 16 : 2) * 1024 * 1024 }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // `.env*` files fill in what the real environment does not set.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const engineId = env.VITE_DETECTION_ENGINE?.trim() || 'cardfit'
  if (!KNOWN_ENGINES.has(engineId)) {
    throw new Error(`VITE_DETECTION_ENGINE="${engineId}" is unknown (expected: ${[...KNOWN_ENGINES].join(', ')})`)
  }
  const base = resolveBase(env.VITE_BASE)
  const buildInfo = resolveBuildInfo(env, gitFromCli())
  const siteUrl = canonicalUrl(resolveSiteUrl(env, buildInfo.repoUrl), base)
  if (!siteUrl) console.warn('[build-info] sin URL del sitio (VITE_SITE_URL): el HTML no lleva og:url ni og:image')
  console.info(`[build-info] sha=${buildInfo.sha ?? 'none'} repoUrl=${buildInfo.repoUrl ?? 'none'} base=${base}`)

  return {
    base,
    // Like GitHub Pages, answer missing files with 404 instead of the SPA index.html,
    // so the e2e guard sees assets requested outside the base. Navigation is state-only.
    appType: 'mpa',
    plugins: [
      react(),
      stripCspInDev(),
      engineCsp(engineId),
      stubScanicMl(),
      sharePreview(siteUrl),
      seoFiles(siteUrl),
      VitePWA({
        strategies: 'generateSW',
        registerType: 'prompt',
        base,
        scope: base,
        manifest: {
          name: 'DNI Print',
          short_name: 'DNI Print',
          description: 'Imprimí tu DNI a tamaño real desde el navegador, sin enviar datos.',
          id: base,
          categories: ['utilities', 'productivity'],
          lang: 'es-AR',
          shortcuts: [{ name: 'Empezar', short_name: 'Empezar', url: base }],
          display: 'standalone',
          start_url: base,
          scope: base,
          theme_color: '#2563A8',
          background_color: '#FBFAF7',
          icons: [
            { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,wasm,svg,png,ico,woff2}'],
          globIgnores: ['og-image.png'],
          ...precacheOptions(engineId),
        },
      }),
    ],
    worker: { format: 'es', plugins: () => [stubScanicMl()] },
    define: {
      __COMMIT_SHA__: JSON.stringify(buildInfo.sha),
      __REPO_URL__: JSON.stringify(buildInfo.repoUrl),
      __SITE_URL__: JSON.stringify(siteUrl),
    },
    test: {
      include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
      exclude: ['tests/e2e/**', 'node_modules/**'],
    },
  }
})
