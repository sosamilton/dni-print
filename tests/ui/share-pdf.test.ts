import { describe, expect, it, vi } from 'vitest'
import { canSharePdf, pdfFile, pdfFileName, sharePdf } from '../../src/ui/share-pdf.ts'
import type { ShareNavigator } from '../../src/ui/share-pdf.ts'

const file = new File([new Uint8Array([37, 80, 68, 70])], 'dni-print-2-copias.pdf', { type: 'application/pdf' })
const ok = () => Promise.resolve()

describe('pdfFileName', () => {
  it('names the file by copies', () => {
    expect(pdfFileName(1)).toBe('dni-print-1-copias.pdf')
    expect(pdfFileName(2)).toBe('dni-print-2-copias.pdf')
  })
})

describe('pdfFile', () => {
  it('is null without a PDF in the session, so the share button stays hidden', () => {
    expect(pdfFile(null)).toBeNull()
  })

  it('wraps the stored bytes as an application/pdf file named by copies', async () => {
    const f = pdfFile({ bytes: new Uint8Array([37, 80, 68, 70]), copies: 1 })!
    expect(f.name).toBe('dni-print-1-copias.pdf')
    expect(f.type).toBe('application/pdf')
    expect(new Uint8Array(await f.arrayBuffer())).toEqual(new Uint8Array([37, 80, 68, 70]))
  })
})

describe('canSharePdf', () => {
  it('is true when share and canShare exist and canShare accepts the file', () => {
    const canShare = vi.fn(() => true)
    expect(canSharePdf({ canShare, share: ok }, file)).toBe(true)
    expect(canShare).toHaveBeenCalledWith({ files: [file] })
  })

  it('is false without share or without canShare', () => {
    expect(canSharePdf({}, file)).toBe(false)
    expect(canSharePdf({ canShare: () => true }, file)).toBe(false)
    expect(canSharePdf({ share: ok }, file)).toBe(false)
  })

  it('is false when canShare rejects files', () => {
    expect(canSharePdf({ canShare: () => false, share: ok }, file)).toBe(false)
  })

  it('is false when canShare throws', () => {
    const nav: ShareNavigator = {
      canShare: () => {
        throw new TypeError('nope')
      },
      share: ok,
    }
    expect(canSharePdf(nav, file)).toBe(false)
  })
})

describe('sharePdf', () => {
  it('shares exactly { files: [file] } and reports shared', async () => {
    const share = vi.fn(ok)
    await expect(sharePdf({ share }, file)).resolves.toBe('shared')
    expect(share).toHaveBeenCalledWith({ files: [file] })
  })

  it('calls share synchronously', () => {
    const share = vi.fn(ok)
    void sharePdf({ share }, file)
    expect(share).toHaveBeenCalledOnce()
  })

  it('reports cancelled on AbortError', async () => {
    const share = () => Promise.reject(new DOMException('cancelled', 'AbortError'))
    await expect(sharePdf({ share }, file)).resolves.toBe('cancelled')
  })

  it('reports failed on any other rejection or a sync throw', async () => {
    await expect(sharePdf({ share: () => Promise.reject(new DOMException('x', 'NotAllowedError')) }, file)).resolves.toBe('failed')
    await expect(sharePdf({ share: () => Promise.reject('boom') }, file)).resolves.toBe('failed')
    const throwing: ShareNavigator = {
      share: () => {
        throw new TypeError('sync')
      },
    }
    await expect(sharePdf(throwing, file)).resolves.toBe('failed')
    await expect(sharePdf({}, file)).resolves.toBe('failed')
  })
})
