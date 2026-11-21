import type { BrowserContext } from '@playwright/test'

export interface NetworkGuard {
  /** Requests (http, https, ws, wss) to any origin other than the app's, in order, without duplicates. */
  externalRequests(): string[]
}

function isExternal(url: string, appOrigin: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol === 'ws:' || parsed.protocol === 'wss:') {
    const httpOrigin = `${parsed.protocol === 'wss:' ? 'https:' : 'http:'}//${parsed.host}`
    return httpOrigin !== appOrigin
  }
  // data:, blob:, about: and friends never reach the network.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
  return parsed.origin !== appOrigin
}

/**
 * Records every request made by the context's pages, workers and service workers,
 * and aborts those aimed at another origin so they never leave the machine.
 * Install it before navigating.
 */
export async function installNetworkGuard(context: BrowserContext, appOrigin: string): Promise<NetworkGuard> {
  const external = new Set<string>()
  const record = (url: string) => {
    if (isExternal(url, appOrigin)) external.add(url)
  }

  context.on('request', (request) => record(request.url()))
  context.on('page', (page) => page.on('websocket', (ws) => record(ws.url())))
  for (const page of context.pages()) page.on('websocket', (ws) => record(ws.url()))

  await context.route('**/*', async (route) => {
    const url = route.request().url()
    if (isExternal(url, appOrigin)) {
      external.add(url)
      await route.abort('blockedbyclient')
      return
    }
    await route.fallback()
  })

  await context.routeWebSocket(/.*/, (ws) => {
    if (isExternal(ws.url(), appOrigin)) {
      external.add(ws.url())
      void ws.close()
      return
    }
    ws.connectToServer()
  })

  return { externalRequests: () => [...external] }
}
