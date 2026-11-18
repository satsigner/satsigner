import {
  CONSOLIDATION_MIN_INPUTS,
  CONSOLIDATION_TAG,
  DUST_ATTACK_MAX_SATS,
  DUST_TAG,
  PAYJOIN_TAG,
  RBF_TAG
} from '@/constants/transaction'
import type { Account } from '@/types/models/Account'
import type { Transaction } from '@/types/models/Transaction'
import { getAccountAddressSets } from '@/utils/address'
import {
  isTransactionUnconfirmed,
  transactionSignalsRbf
} from '@/utils/feeReplacement'
import {
  analyzePossiblePayjoin,
  buildOwnedOutpoints
} from '@/utils/sankeyInputOwnership'
import { isSelfSend } from '@/utils/transaction'

type AutomaticTagSource = Pick<Account, 'addresses' | 'transactions' | 'utxos'>

type AutomaticTagContext = {
  ownAddresses: Set<string>
  ownedOutpoints: Set<string>
}

function buildAutomaticTagContext(
  account: AutomaticTagSource
): AutomaticTagContext {
  return {
    ownAddresses: getAccountAddressSets(account.addresses).ownAddresses,
    ownedOutpoints: buildOwnedOutpoints(account)
  }
}

function isConsolidation(tx: Transaction, ownAddresses: Set<string>) {
  return (
    isSelfSend(tx, ownAddresses) &&
    tx.vin.length >= CONSOLIDATION_MIN_INPUTS &&
    tx.vout.length === 1
  )
}

function isDustReceive(tx: Transaction) {
  return tx.sent === 0 && tx.received > 0 && tx.received <= DUST_ATTACK_MAX_SATS
}

// Only worth flagging while the fee can still be bumped.
function isReplaceable(tx: Transaction) {
  return (
    isTransactionUnconfirmed(tx.blockHeight) && transactionSignalsRbf(tx.vin)
  )
}

function getAutomaticTransactionTags(
  tx: Transaction,
  { ownAddresses, ownedOutpoints }: AutomaticTagContext
) {
  const detected: [string, boolean][] = [
    [CONSOLIDATION_TAG, isConsolidation(tx, ownAddresses)],
    [
      PAYJOIN_TAG,
      analyzePossiblePayjoin(tx.vin, ownedOutpoints).possiblePayjoin
    ],
    [DUST_TAG, isDustReceive(tx)],
    [RBF_TAG, isReplaceable(tx)]
  ]
  return detected.filter(([, matches]) => matches).map(([tag]) => tag)
}

function getAutomaticTagsByTxid(account: AutomaticTagSource) {
  const context = buildAutomaticTagContext(account)
  return new Map(
    account.transactions.map((tx) => [
      tx.id,
      getAutomaticTransactionTags(tx, context)
    ])
  )
}

export {
  buildAutomaticTagContext,
  getAutomaticTagsByTxid,
  getAutomaticTransactionTags,
  isDustReceive
}
export type { AutomaticTagContext }
