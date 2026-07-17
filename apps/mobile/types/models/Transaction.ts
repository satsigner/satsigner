import z from 'zod'

import { PricesSchema } from './Blockchain'

export const TransactionSchema = z.object({
  address: z.string().optional(),
  blockHeight: z.number().optional(),
  fee: z.number().optional(),
  id: z.string(),
  label: z.string().optional(),
  lockTime: z.number().optional(),
  lockTimeEnabled: z.boolean(),
  prices: PricesSchema,
  raw: z.array(z.number()).optional(),
  received: z.number(),
  sent: z.number(),
  size: z.number().optional(),
  timestamp: z.date().optional(),
  type: z.enum(['send', 'receive']),
  version: z.number().optional(),
  vin: z.array(
    z.object({
      label: z.string().optional(),
      previousOutput: z.object({
        txid: z.string(),
        vout: z.number()
      }),
      scriptSig: z.union([z.array(z.number()), z.string()]),
      sequence: z.number(),
      value: z.number().optional(),
      witness: z.array(z.array(z.number()))
    })
  ),
  vout: z.array(
    z.object({
      address: z.string(),
      kind: z.enum(['fakeMix', 'change']).optional(),
      label: z.string().optional(),
      script: z.union([z.array(z.number()), z.string()]),
      value: z.number()
    })
  ),
  vsize: z.number().optional(),
  weight: z.number().optional()
})

export type Transaction = z.infer<typeof TransactionSchema>
