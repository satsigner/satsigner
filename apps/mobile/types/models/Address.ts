import { z } from 'zod'

import { ScriptVersionTypeSchema } from '@/types/models/Script'
import { NetworkSchema } from '@/types/settings/blockchain'

export const AddressSchema = z.object({
  address: z.string(),
  derivationPath: z.string().optional(),
  index: z.number().optional(),
  keychain: z.enum(['internal', 'external']).optional(),
  label: z.string(),
  network: NetworkSchema.optional(),
  scriptVersion: ScriptVersionTypeSchema.optional(),
  summary: z.object({
    balance: z.number(),
    satsInMempool: z.number(),
    transactions: z.number(),
    utxos: z.number()
  }),
  transactions: z.array(z.string()),
  utxos: z.array(z.string())
})

export const WatchedAddressSchema = AddressSchema.extend({
  new: z.boolean().optional()
})

export type Address = z.infer<typeof AddressSchema>

export type WatchedAddress = z.infer<typeof WatchedAddressSchema>
