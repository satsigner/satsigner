import { z } from 'zod'

/** Currency code → value (`fmv`, `rate`); BIP-329 allows any ISO 4217 code. */
export const CurrencyValuesSchema = z.record(z.string(), z.number())

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
  fmv: CurrencyValuesSchema.optional(),
  height: z.number().optional(),
  heights: z.array(z.number()).optional(),
  keypath: z.string().optional(),
  label: z.string(),
  origin: z.string().optional(),
  rate: CurrencyValuesSchema.optional(),
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
