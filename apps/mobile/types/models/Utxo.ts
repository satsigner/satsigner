import { z } from 'zod'

export const UtxoSchema = z.object({
  addressTo: z.string().optional(),
  keychain: z.enum(['internal', 'external']),
  label: z.string().optional(),
  script: z.union([z.array(z.number()), z.string()]).optional(),
  timestamp: z.date().optional(),
  txid: z.string(),
  value: z.number(),
  vout: z.number()
})

export type Utxo = z.infer<typeof UtxoSchema>
