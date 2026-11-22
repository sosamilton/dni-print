import { useSyncExternalStore } from 'react'
import { createMediaQueryStore, WIDE_MEDIA_QUERY } from './menu-model.ts'

const wideStore = createMediaQueryStore(WIDE_MEDIA_QUERY)

/** True from 900px: step 3 shows the output panel beside the sheet instead of the bottom sheet and «Está bien». */
export function useWideLayout(): boolean {
  return useSyncExternalStore(wideStore.subscribe, wideStore.getSnapshot, () => false)
}
