export type BrantaLookupMode = 'always' | 'manual' | 'off'

export type BrantaLookupNotice = 'incomplete' | 'tampered' | 'unavailable'

export type BrantaPayee = {
  description: string
  logoUrl: string
  name: string
  parentLogoUrl?: string
  verifyUrl: string
}
