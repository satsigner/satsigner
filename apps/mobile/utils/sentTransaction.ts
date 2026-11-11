import { hex } from '@scure/base'
import * as bitcoinjs from 'bitcoinjs-lib'

import { SEQUENCE_FINAL, SEQUENCE_RBF } from '@/constants/btc'
import { t } from '@/locales'
import { type Label } from '@/types/bips/329'
import { type Account } from '@/types/models/Account'
import { type Output } from '@/types/models/Output'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type Network } from '@/types/settings/blockchain'
import { bitcoinjsNetwork } from '@/utils/bitcoin'
import { removeReplacedTransaction } from '@/utils/feeReplacement'
import { getRawTransactionSizes } from '@/utils/transaction'
import { annotateTransactionsWithWalletOwnership } from '@/utils/walletOwnership'

type AccountAddress = Account['addresses'][number]

/** What the builder held when its transaction reached the network. */
type SentTransaction = {
  txid: string
  inputs: Utxo[]
  outputs: Output[]
  /** Position of each builder output in the broadcast transaction. */
  vouts: (number | undefined)[]
  fee: number
  rbf: boolean
  replacesTxid?: string
  signedTx?: string
}

type ScriptAmount = {
  script: string | undefined
  amount: number
}

type TransactionOutput = {
  script: string
  value: number
}

/**
 * The vout of each builder output in the final transaction, which BDK and
 * Bitcoin Core shuffle. Outputs match by script and amount, then by script
 * alone (a payjoin receiver adjusts amounts). Equal outputs take the lowest
 * free vout in builder order. An output with no match gets undefined.
 */
function matchOutputVouts(
  outputs: ScriptAmount[],
  transactionOutputs: TransactionOutput[]
): (number | undefined)[] {
  const claimed = new Set<number>()

  function claim(isMatch: (output: TransactionOutput) => boolean) {
    const vout = transactionOutputs.findIndex(
      (output, index) => !claimed.has(index) && isMatch(output)
    )
    if (vout === -1) {
      return undefined
    }
    claimed.add(vout)
    return vout
  }

  const exactVouts = outputs.map(({ amount, script }) =>
    script
      ? claim((output) => output.script === script && output.value === amount)
      : undefined
  )
  return exactVouts.map((vout, index) => {
    const { script } = outputs[index]
    if (vout !== undefined || !script) {
      return vout
    }
    return claim((output) => output.script === script)
  })
}

function addressScriptHex(address: string, network: Network) {
  try {
    return hex.encode(
      bitcoinjs.address.toOutputScript(address, bitcoinjsNetwork(network))
    )
  } catch {
    return undefined
  }
}

function toTransactionOutput(output: { script: Uint8Array; value: bigint }) {
  return { script: hex.encode(output.script), value: Number(output.value) }
}

function readTransactionOutputs(
  signedTxHex?: string,
  psbtBase64?: string
): TransactionOutput[] {
  try {
    if (signedTxHex) {
      return bitcoinjs.Transaction.fromHex(signedTxHex).outs.map(
        toTransactionOutput
      )
    }
    return psbtBase64
      ? bitcoinjs.Psbt.fromBase64(psbtBase64).txOutputs.map(toTransactionOutput)
      : []
  } catch {
    return []
  }
}

/** The vout of each builder output, read from the transaction that was sent. */
function getSentOutputVouts(
  outputs: Pick<Output, 'amount' | 'to'>[],
  sent: { network: Network; psbtBase64?: string; signedTxHex?: string }
) {
  return matchOutputVouts(
    outputs.map((output) => ({
      amount: output.amount,
      script: addressScriptHex(output.to, sent.network)
    })),
    readTransactionOutputs(sent.signedTxHex, sent.psbtBase64)
  )
}

function isDefaultChangeOutput(output: Pick<Output, 'label'>) {
  return output.label === t('sign.changeAddressLabelDefault')
}

function isReturnedBuilderOutput(
  output: Pick<Output, 'kind' | 'to'>,
  ownAddresses: Set<string>
) {
  // Builder marks stonewall decoy/change as kind 'change'. Decoy addresses are
  // often not yet in account.addresses (unused peeked internals).
  return (
    output.kind === 'change' ||
    output.kind === 'fakeMix' ||
    ownAddresses.has(output.to)
  )
}

function makeOptimisticAddress(
  address: string,
  keychain: 'internal' | 'external',
  network: AccountAddress['network']
): AccountAddress {
  return {
    address,
    keychain,
    label: '',
    network,
    summary: { balance: 0, satsInMempool: 0, transactions: 0, utxos: 0 },
    transactions: [],
    utxos: []
  }
}

/** The transaction label: every payment output label, comma separated. */
function getSentTransactionLabel(outputs: Pick<Output, 'label'>[]) {
  return outputs
    .filter((output) => !isDefaultChangeOutput(output))
    .map((output) => output.label)
    .filter(Boolean)
    .join(',')
}

// An output whose vout is unknown gets no output label: a guess could put
// the payment label on the change.
function outputLabels(
  txid: string,
  vout: number | undefined,
  label: string
): Label[] {
  if (vout === undefined) {
    return []
  }
  return [{ label, ref: `${txid}:${vout}`, type: 'output' }]
}

/**
 * BIP329 labels for a sent transaction. They are kept in the account labels
 * and applied when the wallet data is fetched.
 */
function buildSentTransactionLabels({
  outputs,
  txid,
  vouts
}: Pick<SentTransaction, 'outputs' | 'txid' | 'vouts'>): Label[] {
  const txLabel = getSentTransactionLabel(outputs)
  const labels: Label[] = []

  for (const [index, output] of outputs.entries()) {
    if (isDefaultChangeOutput(output)) {
      continue
    }
    labels.push(...outputLabels(txid, vouts[index], output.label), {
      label: output.label,
      ref: output.to,
      type: 'addr'
    })
  }

  labels.push({ label: txLabel, ref: txid, type: 'tx' })

  const changeOutputIndex = outputs.findIndex(isDefaultChangeOutput)
  if (changeOutputIndex === -1) {
    return labels
  }

  const changeLabel = t('sign.changeAddressLabelFinal', { txlabel: txLabel })
  labels.push(...outputLabels(txid, vouts[changeOutputIndex], changeLabel), {
    label: changeLabel,
    ref: outputs[changeOutputIndex].to,
    type: 'addr'
  })
  return labels
}

/** Builder outputs in the order of the sent transaction, unknown ones last. */
function orderBySentVout<T>(outputs: T[], vouts: (number | undefined)[]) {
  return outputs
    .map((output, index) => ({
      output,
      vout: vouts[index] ?? Number.POSITIVE_INFINITY
    }))
    .toSorted((a, b) => a.vout - b.vout)
    .map(({ output }) => output)
}

/**
 * The account with the sent transaction applied, so it shows before the next
 * sync. Undefined when the account already has the transaction.
 */
function addSentTransactionToAccount(
  account: Account,
  sent: SentTransaction
): Account | undefined {
  const { fee, inputs, outputs, rbf, replacesTxid, signedTx, txid, vouts } =
    sent

  if (account.transactions.some((tx) => tx.id === txid)) {
    return undefined
  }

  const totalIn = inputs.reduce((sum, utxo) => sum + utxo.value, 0)
  const ownAddresses = new Set(account.addresses.map((a) => a.address))
  const addressKeychain = new Map<string, Utxo['keychain']>(
    account.addresses.map((address) => [
      address.address,
      address.keychain === 'internal' ? 'internal' : 'external'
    ])
  )
  const receivedReturned = outputs
    .filter((output) => isReturnedBuilderOutput(output, ownAddresses))
    .reduce((sum, output) => sum + output.amount, 0)
  const txLabel = getSentTransactionLabel(outputs)

  const optimisticTx: Transaction = {
    blockHeight: undefined,
    fee,
    id: txid,
    label: txLabel || undefined,
    lockTimeEnabled: false,
    prices: {},
    received: receivedReturned,
    sent: totalIn,
    timestamp: new Date(),
    type: 'send',
    vin: inputs.map((utxo) => ({
      label: utxo.label,
      previousOutput: { txid: utxo.txid, vout: utxo.vout },
      scriptSig: [],
      sequence: rbf ? SEQUENCE_RBF : SEQUENCE_FINAL,
      value: utxo.value,
      witness: []
    })),
    vout: orderBySentVout(outputs, vouts).map((output) => ({
      address: output.to,
      kind: output.kind,
      label: output.label,
      script: '',
      value: output.amount
    })),
    ...(signedTx ? getRawTransactionSizes(signedTx) : {})
  }

  const kept = removeReplacedTransaction(account, replacesTxid)
  const spentOutpoints = new Set(
    inputs.map((utxo) => `${utxo.txid}:${utxo.vout}`)
  )
  const remainingUtxos = kept.utxos.filter(
    (utxo) => !spentOutpoints.has(`${utxo.txid}:${utxo.vout}`)
  )
  const returnedUtxos: Utxo[] = []
  const knownAddresses = new Set(ownAddresses)
  const newAddresses: Account['addresses'] = []
  const network = account.addresses[0]?.network

  for (const [index, output] of outputs.entries()) {
    if (!isReturnedBuilderOutput(output, ownAddresses)) {
      continue
    }

    const keychain =
      output.kind === 'change' || output.kind === 'fakeMix'
        ? 'internal'
        : (addressKeychain.get(output.to) ?? 'external')

    // Without its vout the coin can't be referenced: the next sync adds it.
    const vout = vouts[index]
    if (vout !== undefined) {
      returnedUtxos.push({
        addressTo: output.to,
        keychain,
        label: output.label || '',
        timestamp: new Date(),
        txid,
        value: output.amount,
        vout
      })
    }

    if (!knownAddresses.has(output.to)) {
      knownAddresses.add(output.to)
      newAddresses.push(makeOptimisticAddress(output.to, keychain, network))
    }
  }

  const [annotatedTx] = annotateTransactionsWithWalletOwnership(
    [optimisticTx],
    [...account.addresses, ...newAddresses]
  )

  return {
    ...account,
    addresses: [...account.addresses, ...newAddresses],
    summary: {
      ...account.summary,
      balance:
        account.summary.balance -
        kept.replacedNet -
        (totalIn - receivedReturned),
      numberOfTransactions:
        account.summary.numberOfTransactions +
        1 -
        (account.transactions.length - kept.transactions.length),
      numberOfUtxos: remainingUtxos.length + returnedUtxos.length
    },
    transactions: [annotatedTx ?? optimisticTx, ...kept.transactions],
    utxos: [...returnedUtxos, ...remainingUtxos]
  }
}

export {
  addSentTransactionToAccount,
  buildSentTransactionLabels,
  getSentOutputVouts,
  getSentTransactionLabel,
  matchOutputVouts,
  type SentTransaction
}
