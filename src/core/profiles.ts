// Document profile registry (AD-4). Never branch on `profile.id`; use the measures.
export interface DocumentProfile {
  id: string
  label: string
  widthMm: number
  heightMm: number
}

export const PROFILES: readonly DocumentProfile[] = [
  { id: 'dni-ar', label: 'DNI argentino', widthMm: 85.6, heightMm: 54 },
  { id: 'licencia-ar', label: 'Licencia de conducir', widthMm: 85.6, heightMm: 54 },
]

export const DEFAULT_PROFILE_ID = 'dni-ar'

export function getProfile(id: string): DocumentProfile | undefined {
  return PROFILES.find((profile) => profile.id === id)
}
