import { type Utxo } from '@/types/models/Utxo'

function getUtxoOutpoint(utxo: Pick<Utxo, 'txid' | 'vout'>) {
  return `${utxo.txid}:${utxo.vout}`
}

const OUTPUT_INDEX_PATTERN = /^\d+$/

function parseOutpoint(
  outpoint: string
): { txid: string; vout: number } | null {
  const [txid, vout = '', ...rest] = outpoint.split(':')
  const index = Number(vout)
  if (
    !txid ||
    rest.length > 0 ||
    !OUTPUT_INDEX_PATTERN.test(vout) ||
    !Number.isSafeInteger(index)
  ) {
    return null
  }
  return { txid, vout: index }
}

export { getUtxoOutpoint, parseOutpoint }
