import { type EsploraTx } from '@/types/models/Esplora'
import { type Transaction } from '@/types/models/Transaction'
import { parseHexToBytes } from '@/utils/parse'

function mapEsploraTxToAddressTransaction(
  tx: EsploraTx,
  address: string
): Transaction {
  const vin: Transaction['vin'] = tx.vin.map((input) => ({
    previousOutput: {
      txid: input.txid,
      vout: input.vout
    },
    scriptSig: parseHexToBytes(input.scriptsig ?? ''),
    sequence: input.sequence,
    value: input.prevout?.value,
    witness: input.witness ? input.witness.map(parseHexToBytes) : []
  }))

  const vout: Transaction['vout'] = tx.vout.map((output) => ({
    address: output.scriptpubkey_address || '',
    script: output.scriptpubkey ? parseHexToBytes(output.scriptpubkey) : [],
    value: output.value
  }))

  const sent = tx.vin.reduce((sum, input) => {
    if (input.prevout?.scriptpubkey_address === address) {
      return sum + input.prevout.value
    }
    return sum
  }, 0)

  const received = tx.vout.reduce((sum, output) => {
    if (output.scriptpubkey_address === address) {
      return sum + output.value
    }
    return sum
  }, 0)

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
      ? new Date(tx.status.block_time * 1000)
      : undefined,
    type: received > sent ? 'receive' : 'send',
    version: tx.version,
    vin,
    vout,
    vsize: Math.ceil(tx.weight / 4),
    weight: tx.weight
  }
}

export { mapEsploraTxToAddressTransaction }
