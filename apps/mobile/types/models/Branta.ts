export type BrantaLookupSource = 'qr' | 'paste'

export type BrantaPayee = {
  description: string
  logoUrl: string
  name: string
  parentLogoUrl?: string
  verifyUrl: string
}
