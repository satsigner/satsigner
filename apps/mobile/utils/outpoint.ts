import { type Utxo } from '@/types/models/Utxo'

function getUtxoOutpoint(utxo: Pick<Utxo, 'txid' | 'vout'>) {
  return `${utxo.txid}:${utxo.vout}`
}

export { getUtxoOutpoint }
