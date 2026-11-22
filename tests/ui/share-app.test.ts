import { describe, expect, it, vi } from 'vitest'
import { appShareUrl, appWhatsappLink, shareApp } from '../../src/ui/share-app.ts'
import { strings } from '../../src/ui/strings.es.ts'

const URL_APP = 'https://dueno.github.io/dni-print/'

describe('appShareUrl', () => {
  it('usa la URL canónica del build', () => {
    expect(appShareUrl(URL_APP, { origin: 'http://x' }, '/otra/')).toBe(URL_APP)
  })
  it('sin sitio usa origin + base, sin query ni hash', () => {
    expect(appShareUrl(null, { origin: 'http://localhost:4173' }, '/dni-print/')).toBe('http://localhost:4173/dni-print/')
  })
})

describe('shareApp', () => {
  it('con Web Share comparte {title, text, url}', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    expect(await shareApp({ share }, URL_APP)).toBe('shared')
    expect(share).toHaveBeenCalledWith({ title: strings.shareApp.title, text: strings.shareApp.text, url: URL_APP })
  })
  it('cancelar el menú no es un error', async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' }))
    expect(await shareApp({ share }, URL_APP)).toBe('cancelled')
  })
  it('sin Web Share copia el enlace', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    expect(await shareApp({ clipboard: { writeText } }, URL_APP)).toBe('copied')
    expect(writeText).toHaveBeenCalledWith(URL_APP)
  })
  it('falla sin Web Share ni portapapeles, o si copiar rechaza', async () => {
    expect(await shareApp({}, URL_APP)).toBe('failed')
    expect(await shareApp({ clipboard: { writeText: () => Promise.reject(new Error('no')) } }, URL_APP)).toBe('failed')
  })
})

describe('appWhatsappLink', () => {
  it('lleva el texto y la URL, sin otros datos', () => {
    const link = new URL(appWhatsappLink(URL_APP))
    expect(link.origin + link.pathname).toBe('https://wa.me/')
    expect(link.searchParams.get('text')).toBe(`${strings.shareApp.text} ${URL_APP}`)
  })
})
