import { type Utxo } from '@/types/models/Utxo'

function getUtxoOutpoint(utxo: Utxo) {
  return `${utxo.txid}:${utxo.vout}`
}

export { getUtxoOutpoint }
