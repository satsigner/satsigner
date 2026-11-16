import { hex } from '@scure/base'

import { MS_PER_SECOND } from '@/constants/time'
import { type EsploraTx } from '@/types/models/Esplora'
import { type Transaction } from '@/types/models/Transaction'
import { weightToVsize } from '@/utils/transaction'

function mapEsploraTxToAddressTransaction(
  tx: EsploraTx,
  address: string
): Transaction {
  const vin: Transaction['vin'] = tx.vin.map((input) => ({
    previousOutput: {
      txid: input.txid,
      vout: input.vout
    },
    scriptSig: [...hex.decode(input.scriptsig ?? '')],
    sequence: input.sequence,
    value: input.prevout?.value,
    witness: input.witness ? input.witness.map((w) => [...hex.decode(w)]) : []
  }))

  const vout: Transaction['vout'] = tx.vout.map((output) => ({
    address: output.scriptpubkey_address || '',
    script: output.scriptpubkey ? [...hex.decode(output.scriptpubkey)] : [],
    value: output.value
  }))

  const sent = tx.vin
    .flatMap((input) =>
      input.prevout?.scriptpubkey_address === address
        ? [input.prevout.value]
        : []
    )
    .reduce((sum, value) => sum + value, 0)

  const received = tx.vout
    .filter((output) => output.scriptpubkey_address === address)
    .reduce((sum, output) => sum + output.value, 0)

  return {
    address,
    blockHeight: tx.status.block_height,
    fee: tx.fee,
    id: tx.txid,
    label: '',
    lockTime: tx.locktime,
    lockTimeEnabled: tx.locktime > 0,
    prices: {},
    received,
    sent,
    size: tx.size,
    timestamp: tx.status.block_time
      ? new Date(tx.status.block_time * MS_PER_SECOND)
      : undefined,
    type: received > sent ? 'receive' : 'send',
    version: tx.version,
    vin,
    vout,
    vsize: weightToVsize(tx.weight),
    weight: tx.weight
  }
}

export { mapEsploraTxToAddressTransaction }
