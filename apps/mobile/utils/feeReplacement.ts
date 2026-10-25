import {
  BIP125_REPLACEABLE_SEQUENCE_BELOW,
  DUST_LIMIT,
  INCREMENTAL_RELAY_FEE_RATE
} from '@/constants/btc'
import { type Account } from '@/types/models/Account'
import { type Address } from '@/types/models/Address'
import {
  type FeeReplacementActions,
  type FeeReplacementAssessment,
  type FeeReplacementDraft,
  type FeeReplacementDraftResult,
  type FeeReplacementKind,
  type FeeReplacementRecipient
} from '@/types/models/FeeReplacement'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type Backend } from '@/types/settings/blockchain'
import { getAccountAddressSets } from '@/utils/address'
import { type ExtractedTransactionData } from '@/utils/psbt'
import { estimateTransactionSize } from '@/utils/transaction'
import { filterUtxosByExcludedOutpoints, getUtxoOutpoint } from '@/utils/utxo'

type ReplaceableTransaction = Pick<
  Transaction,
  'blockHeight' | 'fee' | 'id' | 'vin' | 'vout' | 'vsize'
>

const NO_ACTIONS: FeeReplacementActions = {
  bump: false,
  cancel: false,
  cpfp: false
}

function transactionSignalsRbf(inputs: { sequence: number }[]): boolean {
  return inputs.some(
    (input) => input.sequence < BIP125_REPLACEABLE_SEQUENCE_BELOW
  )
}

function isTransactionUnconfirmed(blockHeight?: number): boolean {
  return blockHeight === undefined || blockHeight <= 0
}

function spendsUnconfirmedParent(
  inputs: Pick<Utxo, 'txid'>[],
  transactions: Pick<Transaction, 'blockHeight' | 'id'>[]
): boolean {
  const heightById = new Map(
    transactions.map((tx) => [tx.id, tx.blockHeight] as const)
  )
  return inputs.some(
    (input) =>
      heightById.has(input.txid) &&
      isTransactionUnconfirmed(heightById.get(input.txid))
  )
}

function getTransactionFeeRate(
  tx: Pick<Transaction, 'fee' | 'vsize'>
): number | undefined {
  if (tx.fee === undefined || !tx.vsize || tx.vsize <= 0) {
    return undefined
  }
  return tx.fee / tx.vsize
}

function minimumReplacementFeeRate(originalFeeRate: number | undefined) {
  return Math.ceil(originalFeeRate ?? 0) + INCREMENTAL_RELAY_FEE_RATE
}

function getSpendableUtxos(
  account: Pick<Account, 'excludedUtxoOutpoints' | 'utxos'>
): Utxo[] {
  return filterUtxosByExcludedOutpoints(
    account.utxos,
    account.excludedUtxoOutpoints ?? []
  )
}

function getExcludedUtxos(
  account: Pick<Account, 'excludedUtxoOutpoints' | 'utxos'>
): Utxo[] {
  const excluded = new Set(account.excludedUtxoOutpoints)
  return account.utxos.filter((utxo) => excluded.has(getUtxoOutpoint(utxo)))
}

function assessAccountTransaction(input: {
  ownedOutpoints: Set<string>
  spendableOutpoints: Set<string>
  transactions: Pick<Transaction, 'vin'>[]
  tx: ReplaceableTransaction
}): FeeReplacementAssessment {
  const { tx } = input
  const unconfirmed = isTransactionUnconfirmed(tx.blockHeight)
  const signalsRbf = transactionSignalsRbf(tx.vin)
  const allInputsOwned =
    tx.vin.length > 0 &&
    tx.vin.every((vin) =>
      input.ownedOutpoints.has(getUtxoOutpoint(vin.previousOutput))
    )
  const hasSpendableOutput = tx.vout.some((_, vout) =>
    input.spendableOutpoints.has(getUtxoOutpoint({ txid: tx.id, vout }))
  )
  // Replacing a parent evicts its children, and the replacement would not
  // carry their payments.
  const hasChildTransaction = input.transactions.some((child) =>
    child.vin.some((vin) => vin.previousOutput.txid === tx.id)
  )
  return {
    canBumpOrCancel:
      unconfirmed && signalsRbf && allInputsOwned && !hasChildTransaction,
    canCpfp: unconfirmed && hasSpendableOutput,
    signalsRbf,
    unconfirmed
  }
}

function getReplacementActions(
  assessment: FeeReplacementAssessment,
  context: {
    backend: Backend
    feeRateKnown: boolean
    hasBumpRecipients: boolean
    policyType: Account['policyType']
    vsizeKnown: boolean
  }
): FeeReplacementActions {
  if (context.policyType === 'watchonly' || !context.vsizeKnown) {
    return NO_ACTIONS
  }
  // The replacement is built from the wallet's own transaction graph, which
  // the Bitcoin Core wallet backend does not populate. Multisig is left out:
  // without spending assets BDK plans a single key set and writes only those
  // derivations, so the other cosigners could not sign.
  const canReplace =
    assessment.canBumpOrCancel &&
    context.feeRateKnown &&
    context.backend !== 'rpc' &&
    context.policyType === 'singlesig'
  return {
    bump: canReplace && context.hasBumpRecipients,
    cancel: canReplace,
    cpfp: assessment.canCpfp
  }
}

function getFeeReplacementOptions(input: {
  account: Pick<
    Account,
    | 'addresses'
    | 'excludedUtxoOutpoints'
    | 'policyType'
    | 'transactions'
    | 'utxos'
  >
  backend: Backend
  ownedOutpoints: Set<string>
  tx: ReplaceableTransaction
}): { actions: FeeReplacementActions; assessment: FeeReplacementAssessment } {
  const assessment = assessAccountTransaction({
    ownedOutpoints: input.ownedOutpoints,
    spendableOutpoints: new Set(
      getSpendableUtxos(input.account).map(getUtxoOutpoint)
    ),
    transactions: input.account.transactions,
    tx: input.tx
  })
  const bumpRecipients = getBumpRecipients(
    input.tx.vout,
    getAccountAddressSets(input.account.addresses).internalAddresses
  )
  const actions = getReplacementActions(assessment, {
    backend: input.backend,
    feeRateKnown: getTransactionFeeRate(input.tx) !== undefined,
    hasBumpRecipients: (bumpRecipients?.length ?? 0) > 0,
    policyType: input.account.policyType,
    vsizeKnown: (input.tx.vsize ?? 0) > 0
  })
  return { actions, assessment }
}

function parseFeeReplacementKind(
  value: string | string[] | undefined
): FeeReplacementKind | undefined {
  const kind = Array.isArray(value) ? value[0] : value
  if (kind === 'bump' || kind === 'cancel' || kind === 'cpfp') {
    return kind
  }
  return undefined
}

function getBumpRecipients(
  vout: Pick<Transaction['vout'][number], 'address' | 'value'>[],
  internalAddresses: Set<string>
): FeeReplacementRecipient[] | undefined {
  const payments = vout.filter(
    (output) => !internalAddresses.has(output.address)
  )
  if (payments.some((output) => !output.address)) {
    return undefined
  }
  return payments.map((output) => ({
    address: output.address,
    amountSats: output.value
  }))
}

function pickCpfpUtxo(
  account: Pick<Account, 'excludedUtxoOutpoints' | 'utxos'>,
  txid: string
): Utxo | undefined {
  return getSpendableUtxos(account)
    .filter((utxo) => utxo.txid === txid)
    .toSorted((left, right) => right.value - left.value)[0]
}

function minimumChildFee(input: {
  childVsize: number
  parentFee: number
  parentVsize: number
  targetFeeRate: number
}): number {
  const packageVsize = input.parentVsize + input.childVsize
  const packageFee = Math.ceil(input.targetFeeRate * packageVsize)
  const fromPackage = packageFee - input.parentFee
  const relayFloor = INCREMENTAL_RELAY_FEE_RATE * Math.max(input.childVsize, 1)
  return Math.max(fromPackage, relayFloor)
}

function buildCpfpDraft(input: {
  destination: string
  destinationLabel: string
  parentFee: number
  parentVsize: number
  targetFeeRate: number
  utxo: Utxo
}): FeeReplacementDraftResult {
  if (!input.destination) {
    return { ok: false, reason: 'no-destination' }
  }
  const output = {
    amount: 0,
    label: input.destinationLabel,
    to: input.destination
  }
  const childVsize = estimateTransactionSize(
    [input.utxo],
    [{ ...output, localId: '0' }]
  ).vsize
  const fee = minimumChildFee({
    childVsize,
    parentFee: input.parentFee,
    parentVsize: input.parentVsize,
    targetFeeRate: input.targetFeeRate
  })
  const amount = input.utxo.value - fee
  if (amount < DUST_LIMIT) {
    return { ok: false, reason: 'insufficient' }
  }
  return {
    draft: {
      fee,
      feeRate: Math.ceil(fee / Math.max(childVsize, 1)),
      inputs: [input.utxo],
      outputs: [{ ...output, amount }]
    },
    ok: true
  }
}

// Drops a transaction that a just-broadcast replacement conflicts with, with
// the outputs it created, and returns its net effect on the balance.
function removeReplacedTransaction(
  account: Pick<Account, 'transactions' | 'utxos'>,
  replacesTxid: string | undefined
): { replacedNet: number; transactions: Transaction[]; utxos: Utxo[] } {
  const replaced = account.transactions.find((tx) => tx.id === replacesTxid)
  if (!replaced) {
    return {
      replacedNet: 0,
      transactions: account.transactions,
      utxos: account.utxos
    }
  }
  return {
    replacedNet: replaced.received - replaced.sent,
    transactions: account.transactions.filter((tx) => tx.id !== replaced.id),
    utxos: account.utxos.filter((utxo) => utxo.txid !== replaced.id)
  }
}

// Outputs that are neither a kept recipient nor the sweep destination are the
// change output BDK added, at an address the account may not know yet.
function buildDraftFromReplacementPsbt(input: {
  addresses: Pick<Address, 'address' | 'keychain'>[]
  changeLabel: string
  extracted: Pick<ExtractedTransactionData, 'fee' | 'inputs' | 'outputs'>
  feeRate: number
  labelByAddress: Map<string, string>
}): FeeReplacementDraft {
  const keychainByAddress = new Map(
    input.addresses.map((entry) => [entry.address, entry.keychain] as const)
  )
  return {
    fee: input.extracted.fee,
    feeRate: input.feeRate,
    inputs: input.extracted.inputs.map((entry) => ({
      addressTo: entry.address,
      keychain:
        keychainByAddress.get(entry.address ?? '') === 'internal'
          ? 'internal'
          : 'external',
      script: entry.script,
      txid: entry.txid,
      value: entry.value,
      vout: entry.vout
    })),
    outputs: input.extracted.outputs.map((entry) => {
      const label = input.labelByAddress.get(entry.address)
      if (label === undefined) {
        return {
          amount: entry.value,
          kind: 'change',
          label: input.changeLabel,
          to: entry.address
        }
      }
      return { amount: entry.value, label, to: entry.address }
    })
  }
}

export {
  buildCpfpDraft,
  buildDraftFromReplacementPsbt,
  getBumpRecipients,
  getExcludedUtxos,
  getFeeReplacementOptions,
  getReplacementActions,
  getTransactionFeeRate,
  minimumChildFee,
  minimumReplacementFeeRate,
  parseFeeReplacementKind,
  pickCpfpUtxo,
  removeReplacedTransaction,
  spendsUnconfirmedParent,
  transactionSignalsRbf
}
