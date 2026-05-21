import { z } from 'zod'

import { PricesSchema } from '@/types/models/Blockchain'

export const LabelTypeSchema = z.enum([
  'tx',
  'addr',
  'pubkey',
  'input',
  'output',
  'xpub'
])

export const LabelSchema = z.object({
  fee: z.number().optional(),
  fmv: PricesSchema.optional(),
  height: z.number().optional(),
  heights: z.array(z.number()).optional(),
  keypath: z.string().optional(),
  label: z.string(),
  origin: z.string().optional(),
  rate: PricesSchema.optional(),
  ref: z.string(),
  spendable: z.boolean().optional(),
  time: z.date().optional(),
  type: LabelTypeSchema,
  value: z.number().optional()
})

export const Bip329FileTypeSchema = z.enum(['JSONL', 'JSON', 'CSV'])

export const bip329FileTypes: Bip329FileType[] = ['JSONL', 'JSON', 'CSV']

export type LabelType = z.infer<typeof LabelTypeSchema>
export type Label = z.infer<typeof LabelSchema>
export type Bip329FileType = z.infer<typeof Bip329FileTypeSchema>
