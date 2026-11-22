import { describe, expect, it } from 'vitest'
import { supportsFolderPicker, writePdfToFolder, type FolderHandle } from '../../src/ui/save-folder.ts'

function fakeFolder(permission: PermissionState, fail = false) {
  const written: { name: string; data: unknown }[] = []
  const handle: FolderHandle = {
    name: 'Imprentas',
    queryPermission: async () => permission,
    requestPermission: async () => permission,
    getFileHandle: async (name) => {
      if (fail) throw new Error('boom')
      return {
        createWritable: async () => ({
          write: async (data) => void written.push({ name, data }),
          close: async () => {},
        }),
      }
    },
  }
  return { handle, written }
}

describe('save-folder', () => {
  it('detecta la API por característica', () => {
    expect(supportsFolderPicker({})).toBe(false)
    expect(supportsFolderPicker({ showDirectoryPicker: () => {} })).toBe(true)
  })

  it('escribe el PDF con permiso concedido', async () => {
    const { handle, written } = fakeFolder('granted')
    expect(await writePdfToFolder(handle, new Uint8Array([1]), 'a.pdf')).toBe(true)
    expect(written[0]?.name).toBe('a.pdf')
  })

  it('devuelve false si el permiso se niega o falla la escritura', async () => {
    expect(await writePdfToFolder(fakeFolder('denied').handle, new Uint8Array(), 'a.pdf')).toBe(false)
    expect(await writePdfToFolder(fakeFolder('granted', true).handle, new Uint8Array(), 'a.pdf')).toBe(false)
  })
})
