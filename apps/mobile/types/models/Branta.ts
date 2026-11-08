import z from 'zod'

export type BrantaLookupMode = 'always' | 'manual' | 'off'

export type BrantaLookupNotice = 'incomplete' | 'tampered' | 'unavailable'

export const BrantaPayeeSchema = z.object({
  description: z.string(),
  logoUrl: z.string(),
  name: z.string(),
  parentLogoUrl: z.string().optional(),
  verifyUrl: z.string()
})

export type BrantaPayee = z.infer<typeof BrantaPayeeSchema>
