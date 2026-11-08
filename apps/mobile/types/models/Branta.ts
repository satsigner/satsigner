import z from 'zod'

export const BrantaLookupModeSchema = z.enum(['always', 'manual', 'off'])

export type BrantaLookupMode = z.infer<typeof BrantaLookupModeSchema>

export type BrantaLookupNotice = 'incomplete' | 'tampered' | 'unavailable'

export const BrantaPayeeSchema = z.object({
  description: z.string(),
  logoUrl: z.string(),
  name: z.string(),
  parentLogoUrl: z.string().optional(),
  verifyUrl: z.string()
})

export type BrantaPayee = z.infer<typeof BrantaPayeeSchema>
