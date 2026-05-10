import z from 'zod'

export const EsploraTxSchema = z.object({
  fee: z.number(),
  locktime: z.number(),
  size: z.number(),
  status: z.object({
    block_hash: z.string(),
    block_height: z.number(),
    block_time: z.number(),
    confirmed: z.boolean()
  }),
  txid: z.string(),
  version: z.number(),
  vin: z.array(
    z.object({
      is_coinbase: z.boolean(),
      prevout: z.object({
        scriptpubkey: z.string(),
        scriptpubkey_address: z.string(),
        scriptpubkey_asm: z.string(),
        scriptpubkey_type: z.string(),
        value: z.number()
      }),
      scriptsig: z.string(),
      scriptsig_asm: z.string(),
      sequence: z.number(),
      txid: z.string(),
      vout: z.number(),
      witness: z.array(z.string())
    })
  ),
  vout: z.array(
    z.object({
      scriptpubkey: z.string(),
      scriptpubkey_address: z.string(),
      scriptpubkey_asm: z.string(),
      scriptpubkey_type: z.string(),
      value: z.number()
    })
  ),
  weight: z.number()
})

export const EsploraUtxoSchema = z.object({
  status: z.object({
    block_hash: z.string().optional(),
    block_height: z.number().optional(),
    block_time: z.number().optional(),
    confirmed: z.boolean()
  }),
  txid: z.string(),
  value: z.number(),
  vout: z.number()
})

export const EsploraTxOutspendsSchema = z.array(
  z.object({
    spent: z.boolean()
  })
)

export type EsploraTx = z.infer<typeof EsploraTxSchema>
export type EsploraUtxo = z.infer<typeof EsploraUtxoSchema>
export type EsploraTxOutspends = z.infer<typeof EsploraTxOutspendsSchema>
