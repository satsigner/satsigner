import z from 'zod'

import { NetworkSchema } from '../settings/blockchain'
import { TransactionSchema } from './Transaction'
import { UtxoSchema } from './Utxo'

export const ElectrumClientSchema = z.object({
  addressBalance: z.object({
    confirmed: z.number(),
    unconfirmed: z.number()
  }),
  addressTxs: z.array(
    z.object({
      height: z.number(),
      tx_hash: z.string()
    })
  ),
  addressUnconfirmed: z.array(
    z.object({
      fee: z.number(),
      height: z.number(),
      tx_hash: z.string()
    })
  ),
  addressUtxos: z.array(
    z.object({
      height: z.number(),
      tx_hash: z.string(),
      tx_pos: z.number(),
      value: z.number()
    })
  ),
  props: z.object({
    host: z.string(),
    network: NetworkSchema.optional(),
    port: z.number(),
    protocol: z.enum(['tcp', 'tls', 'ssl']).optional()
  }),
  transaction: z.object({
    blockhash: z.string(),
    blocktime: z.number(),
    confirmations: z.number(),
    hash: z.string(),
    hex: z.string(),
    locktime: z.number(),
    size: z.number(),
    time: z.number(),
    txid: z.string(),
    version: z.number(),
    vin: z.array(
      z.object({
        scriptSig: z.object({
          asm: z.string(),
          hex: z.string()
        }),
        sequence: z.number(),
        txid: z.string(),
        vout: z.number()
      })
    ),
    vout: z.array(
      z.object({
        n: z.number(),
        scriptPubkey: z.object({
          addresses: z.array(z.string()),
          asm: z.string(),
          hex: z.string(),
          reqSigs: z.number(),
          type: z.string()
        }),
        value: z.string()
      })
    )
  }),
  transactionRaw: z.object({
    id: z.string(),
    jsonrpc: z.string(),
    param: z.string(),
    result: z.string()
  })
})

export const ElectrumAddressInfoSchema = z.object({
  balance: z.object({
    confirmed: z.number(),
    unconfirmed: z.number()
  }),
  transactions: z.array(TransactionSchema),
  utxos: z.array(UtxoSchema)
})

export type ElectrumClientInterface = z.infer<typeof ElectrumClientSchema>
export type ElectrumAddressInfo = z.infer<typeof ElectrumAddressInfoSchema>
