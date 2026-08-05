import { PAYJOIN_MIN_CONTRIBUTE_SATS } from '@/constants/payjoin'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'

function isConfirmedUtxo(
  utxo: Utxo,
  transactions: readonly Transaction[]
): boolean {
  return transactions.some(
    (tx) => tx.id === utxo.txid && (tx.blockHeight ?? 0) > 0
  )
}

function filterPayjoinContributeUtxos(
  utxos: readonly Utxo[],
  transactions: readonly Transaction[],
  minValueSats: number = PAYJOIN_MIN_CONTRIBUTE_SATS
): Utxo[] {
  return utxos.filter(
    (utxo) => utxo.value > minValueSats && isConfirmedUtxo(utxo, transactions)
  )
}

function walletCanContributeToPayjoin(
  utxos: readonly Utxo[],
  transactions: readonly Transaction[],
  minValueSats: number = PAYJOIN_MIN_CONTRIBUTE_SATS
): boolean {
  return (
    filterPayjoinContributeUtxos(utxos, transactions, minValueSats).length > 0
  )
}

export {
  filterPayjoinContributeUtxos,
  isConfirmedUtxo,
  walletCanContributeToPayjoin
}
