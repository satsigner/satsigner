import {
  SAMPLE_CHANGE_ADDRESS_LABEL,
  SAMPLE_CHANGE_LABEL_PREFIX,
  SAMPLE_DUST_LABELS,
  SAMPLE_RECEIVE_ADDRESS_NAMES,
  SAMPLE_RECEIVE_BUCKETS,
  SAMPLE_SELF_TRANSFER_LABELS,
  SAMPLE_SEND_BUCKETS,
  SAMPLE_UNLABELED_COIN
} from '@/constants/sampleLabels'
import { DUST_ATTACK_MAX_SATS, SELF_SEND_TAG } from '@/constants/transaction'
import { type Label } from '@/types/bips/329'
import { type Account } from '@/types/models/Account'
import { type Address } from '@/types/models/Address'
import { type Transaction } from '@/types/models/Transaction'
import { addLabelTag, parseLabel, parseLabelTags } from '@/utils/parse'
import { type SampleWallet } from '@/utils/sampleWallet'
import { isSelfSend } from '@/utils/transaction'

type LabelSource = Pick<Account, 'addresses' | 'transactions' | 'utxos'>

function compareByChainOrder(a: Transaction, b: Transaction) {
  const heightA = a.blockHeight ?? Number.MAX_SAFE_INTEGER
  const heightB = b.blockHeight ?? Number.MAX_SAFE_INTEGER
  return heightA - heightB || a.id.localeCompare(b.id)
}

function isDustReceive(tx: Transaction) {
  return tx.sent === 0 && tx.received <= DUST_ATTACK_MAX_SATS
}

function createStoryPicker(buckets: typeof SAMPLE_RECEIVE_BUCKETS) {
  const usage = buckets.map(() => 0)
  return (sats: number) => {
    const index = buckets.findIndex(({ maxSats }) => sats <= maxSats)
    const { stories } = buckets[index]
    const story = stories[usage[index] % stories.length]
    usage[index] += 1
    return story
  }
}

function createCycler(labels: string[]) {
  const counter = { next: 0 }
  return () => {
    const label = labels[counter.next % labels.length]
    counter.next += 1
    return label
  }
}

function buildTransactionLabels(account: LabelSource) {
  const ownAddresses = new Set(account.addresses.map(({ address }) => address))
  const pickReceiveStory = createStoryPicker(SAMPLE_RECEIVE_BUCKETS)
  const pickSendStory = createStoryPicker(SAMPLE_SEND_BUCKETS)
  const nextDustLabel = createCycler(SAMPLE_DUST_LABELS)
  const nextSelfTransferLabel = createCycler(SAMPLE_SELF_TRANSFER_LABELS)
  const labelsByTxid = new Map<string, string>()

  for (const tx of account.transactions.toSorted(compareByChainOrder)) {
    if (isDustReceive(tx)) {
      labelsByTxid.set(tx.id, nextDustLabel())
    } else if (isSelfSend(tx, ownAddresses)) {
      labelsByTxid.set(
        tx.id,
        addLabelTag(nextSelfTransferLabel(), SELF_SEND_TAG)
      )
    } else if (tx.type === 'receive') {
      labelsByTxid.set(tx.id, pickReceiveStory(tx.received - tx.sent))
    } else {
      labelsByTxid.set(tx.id, pickSendStory(tx.sent - tx.received))
    }
  }

  return labelsByTxid
}

function getStoryWithoutSelfSendTag(txLabel: string | undefined) {
  if (!txLabel) {
    return undefined
  }
  const { label, tags } = parseLabel(txLabel)
  return parseLabelTags(
    label,
    tags.filter((tag) => tag !== SELF_SEND_TAG)
  )
}

function getUtxoLabel(
  txLabel: string | undefined,
  value: number,
  keychain: Address['keychain']
) {
  if (value <= DUST_ATTACK_MAX_SATS) {
    return txLabel ?? SAMPLE_DUST_LABELS[0]
  }
  if (keychain === 'internal') {
    return `${SAMPLE_CHANGE_LABEL_PREFIX}: ${txLabel ?? ''}`.trim()
  }
  return txLabel ?? SAMPLE_UNLABELED_COIN
}

const EMOJI_PATTERN = /[\p{Extended_Pictographic}\uFE0F]/gu

function getPlainStory(story: string) {
  return parseLabel(story).label.replaceAll(EMOJI_PATTERN, '').trim()
}

function getReceiveAddressName(index: number) {
  const names = SAMPLE_RECEIVE_ADDRESS_NAMES
  const name = names[index % names.length]
  const round = Math.floor(index / names.length)
  return round === 0 ? name : `${name} ${round + 1}`
}

function getAddressLabel(address: Address, firstTxLabel: string | undefined) {
  if (address.keychain !== 'internal') {
    return getReceiveAddressName(address.index ?? 0)
  }
  const story = firstTxLabel ? getPlainStory(firstTxLabel) : ''
  return story
    ? `${SAMPLE_CHANGE_ADDRESS_LABEL} from ${story}`
    : SAMPLE_CHANGE_ADDRESS_LABEL
}

function getFirstTxLabel(address: Address, labelsByTxid: Map<string, string>) {
  const txid = address.transactions.find((id) => labelsByTxid.has(id))
  return txid ? getStoryWithoutSelfSendTag(labelsByTxid.get(txid)) : undefined
}

function buildSampleWalletLabels(
  sample: SampleWallet,
  account: LabelSource
): Label[] {
  if (sample !== 'segwit') {
    return []
  }

  const labelsByTxid = buildTransactionLabels(account)

  const txLabels: Label[] = [...labelsByTxid].map(([ref, label]) => ({
    label,
    ref,
    type: 'tx'
  }))

  const utxoLabels: Label[] = account.utxos.map((utxo) => ({
    label: getUtxoLabel(
      getStoryWithoutSelfSendTag(labelsByTxid.get(utxo.txid)),
      utxo.value,
      utxo.keychain
    ),
    ref: `${utxo.txid}:${utxo.vout}`,
    type: 'output'
  }))

  const addressLabels: Label[] = account.addresses.map((address) => ({
    label: getAddressLabel(address, getFirstTxLabel(address, labelsByTxid)),
    ref: address.address,
    type: 'addr'
  }))

  return [...txLabels, ...utxoLabels, ...addressLabels]
}

export { buildSampleWalletLabels }
