import type {
  DevConsoleEntry,
  DevConsoleLevel
} from '@/types/models/DevConsole'
import type { Output } from '@/types/models/Output'
import type { Transaction } from '@/types/models/Transaction'
import type { Utxo } from '@/types/models/Utxo'
import type { LightningBubbleChannelRow } from '@/utils/lightningChannelsBubbleLayout'

export const SAMPLE_DUST_LIMIT = 546

const UINT32_RANGE = 2 ** 32
const TXID_WORDS = 8
const ADDRESS_BODY_LENGTH = 38
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
const BECH32_CHARACTERS = [...BECH32_CHARSET]
const SAMPLE_PRICES = { USD: 65_000 }
const SAMPLE_SCRIPT = '0014cc5159408ffdbb39adfd5ed60ac49da7d18a4f4a'
const SAMPLE_SEQUENCE = 0xff_ff_ff_fd
const SAMPLE_VSIZE_PER_INPUT = 68
const SAMPLE_VSIZE_PER_OUTPUT = 31
const SAMPLE_VSIZE_OVERHEAD = 11
const SAMPLE_WEIGHT_PER_VBYTE = 4
const BLOCKS_PER_DAY = 144
const MS_PER_DAY = 86_400_000
const CHANGE_SHARE_MIN = 0.1
const CHANGE_SHARE_RANGE = 0.25
const OUTPUT_WEIGHT_SKEW = 3
const COINJOIN_INPUT_HEADROOM = 1.6
const LABEL_CHANCE = 0.6
const INTERNAL_CHANCE = 0.3

const SAMPLE_LABELS = [
  'Salary',
  'Exchange withdrawal',
  'Coffee',
  'Rent',
  'Hardware wallet',
  'Zap payout',
  'Savings #cold',
  'Gift from grandma #family',
  'Consolidation #utxo #cleanup',
  'Very long label to check how the row wraps when a description goes on and on'
]

const SAMPLE_PEERS = [
  'ACINQ',
  'Voltage',
  'WalletOfSatoshi',
  'Kraken',
  'LNBig',
  'Boltz',
  'River',
  'Strike',
  'a-very-long-node-alias-that-keeps-going'
]

const SAMPLE_LOG_SCOPES = [
  'startup',
  'sync',
  'electrum',
  'nostr',
  'fees',
  'ark'
]
const SAMPLE_LOG_LEVELS: DevConsoleLevel[] = [
  'info',
  'info',
  'step',
  'warn',
  'error'
]
const SAMPLE_LOG_MESSAGES = [
  'hydrate stores',
  'synced 42 transactions',
  'fee estimate stale, retrying',
  'relay timed out',
  'ssl://electrum.blockstream.info:50002',
  'descriptor wpkh([73c5da0a/84h/0h/0h]xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWKiKrhko4egpiMZbpiaQL2jkwSB1icqYh2cfDfVxdx4df189oLKnC5fSwqPfgyP3hooxujYzAu3fDVmz/0/*)'
]

export type SampleRandom = () => number

function toUint32(value: number) {
  return ((value % UINT32_RANGE) + UINT32_RANGE) % UINT32_RANGE
}

/** mulberry32: tiny seeded PRNG so design samples render the same every time. */
export function createSampleRandom(seed: number): SampleRandom {
  const state = { value: toUint32(seed) }
  return function next() {
    state.value = toUint32(state.value + 0x6d_2b_79_f5)
    const a = state.value
    const b = Math.imul(a ^ (a >>> 15), a | 1)
    const c = b ^ (b + Math.imul(b ^ (b >>> 7), b | 61))
    return toUint32(c ^ (c >>> 14)) / UINT32_RANGE
  }
}

function pick<T>(random: SampleRandom, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]
}

function sampleValue(random: SampleRandom, min: number, max: number) {
  const low = Math.log(min)
  const high = Math.log(max)
  return Math.round(Math.exp(low + random() * (high - low)))
}

export function sampleTxid(random: SampleRandom): string {
  return Array.from({ length: TXID_WORDS }, () =>
    Math.floor(random() * UINT32_RANGE)
      .toString(16)
      .padStart(8, '0')
  ).join('')
}

export function sampleAddress(random: SampleRandom): string {
  const body = Array.from({ length: ADDRESS_BODY_LENGTH }, () =>
    pick(random, BECH32_CHARACTERS)
  ).join('')
  return `bc1q${body}`
}

function sampleLabel(random: SampleRandom): string | undefined {
  return random() < LABEL_CHANCE ? pick(random, SAMPLE_LABELS) : undefined
}

function estimateVsize(inputCount: number, outputCount: number) {
  return (
    SAMPLE_VSIZE_OVERHEAD +
    inputCount * SAMPLE_VSIZE_PER_INPUT +
    outputCount * SAMPLE_VSIZE_PER_OUTPUT
  )
}

type SampleUtxoOptions = {
  count: number
  min: number
  max: number
  seed: number
  start?: Date
}

const SAMPLE_UTXO_START = new Date('2023-01-01T00:00:00Z')

export function buildSampleUtxos({
  count,
  min,
  max,
  seed,
  start = SAMPLE_UTXO_START
}: SampleUtxoOptions): Utxo[] {
  const random = createSampleRandom(seed)
  return Array.from({ length: count }, (_, index) => ({
    addressTo: sampleAddress(random),
    keychain: random() < INTERNAL_CHANCE ? 'internal' : 'external',
    label: sampleLabel(random),
    timestamp: new Date(start.getTime() + index * MS_PER_DAY),
    txid: sampleTxid(random),
    value: Math.max(SAMPLE_DUST_LIMIT, sampleValue(random, min, max)),
    vout: Math.floor(random() * 4)
  }))
}

type SampleChartTransactionOptions = {
  seed: number
  inputCount: number
  outputCount: number
  inputMin?: number
  inputMax?: number
  counterpartyInputCount?: number
  feeRate?: number
  equalOutputValue?: number
}

export type SampleChartTransaction = {
  feeRate: number
  internalAddresses: Set<string>
  ownAddresses: Set<string>
  ownedOutpoints: Set<string>
  transaction: Transaction
}

const DEFAULT_SAMPLE_FEE_RATE = 12
const DEFAULT_INPUT_MIN = 10_000
const DEFAULT_INPUT_MAX = 200_000_000

function splitAmount(
  random: SampleRandom,
  total: number,
  parts: number
): number[] {
  const weights = Array.from(
    { length: parts },
    () => random() ** OUTPUT_WEIGHT_SKEW + Number.EPSILON
  )
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0)
  return weights.map((weight) =>
    Math.max(SAMPLE_DUST_LIMIT, Math.floor((weight / weightTotal) * total))
  )
}

export function buildSampleChartTransaction({
  seed,
  inputCount,
  outputCount,
  inputMin = DEFAULT_INPUT_MIN,
  inputMax = DEFAULT_INPUT_MAX,
  counterpartyInputCount = 0,
  feeRate = DEFAULT_SAMPLE_FEE_RATE,
  equalOutputValue
}: SampleChartTransactionOptions): SampleChartTransaction {
  const random = createSampleRandom(seed)
  const minInput = equalOutputValue
    ? Math.round(equalOutputValue * COINJOIN_INPUT_HEADROOM)
    : inputMin
  const vin = Array.from({ length: inputCount }, () => ({
    label: sampleLabel(random),
    previousOutput: {
      txid: sampleTxid(random),
      vout: Math.floor(random() * 3)
    },
    scriptSig: '',
    sequence: SAMPLE_SEQUENCE,
    value: sampleValue(random, minInput, Math.max(minInput, inputMax)),
    witness: []
  }))
  const ownInputCount = inputCount - counterpartyInputCount
  const ownedOutpoints = new Set(
    vin
      .slice(0, ownInputCount)
      .map(
        (input) => `${input.previousOutput.txid}:${input.previousOutput.vout}`
      )
  )
  const ownInputTotal = vin
    .slice(0, ownInputCount)
    .reduce((sum, input) => sum + input.value, 0)
  const inputTotal = vin.reduce((sum, input) => sum + input.value, 0)
  const vsize = estimateVsize(inputCount, outputCount + 1)
  const fee = vsize * feeRate
  const spendable = inputTotal - fee
  const changeAddress = sampleAddress(random)
  const receiveAddress = sampleAddress(random)

  const paymentValues = equalOutputValue
    ? Array.from({ length: outputCount }, () => equalOutputValue)
    : splitAmount(
        random,
        Math.floor(
          spendable * (1 - CHANGE_SHARE_MIN - random() * CHANGE_SHARE_RANGE)
        ),
        outputCount
      )
  const paymentTotal = paymentValues.reduce((sum, value) => sum + value, 0)
  const changeValue = Math.max(SAMPLE_DUST_LIMIT, spendable - paymentTotal)

  const payments = paymentValues.map((value, index) => ({
    address:
      equalOutputValue && index === 0 ? receiveAddress : sampleAddress(random),
    label: equalOutputValue ? undefined : sampleLabel(random),
    script: SAMPLE_SCRIPT,
    value
  }))
  const change = {
    address: changeAddress,
    kind: 'change' as const,
    script: SAMPLE_SCRIPT,
    value: changeValue
  }
  const ownAddresses = new Set([changeAddress])
  if (equalOutputValue) {
    ownAddresses.add(receiveAddress)
  }
  const ownOutputTotal = [...payments, change]
    .filter((output) => ownAddresses.has(output.address))
    .reduce((sum, output) => sum + output.value, 0)

  return {
    feeRate,
    internalAddresses: new Set([changeAddress]),
    ownAddresses,
    ownedOutpoints,
    transaction: {
      fee,
      id: sampleTxid(random),
      label: sampleLabel(random),
      lockTimeEnabled: false,
      prices: SAMPLE_PRICES,
      received: ownOutputTotal,
      sent: ownInputTotal,
      size: vsize * 2,
      type: ownOutputTotal > ownInputTotal ? 'receive' : 'send',
      vin,
      vout: [...payments, change],
      vsize,
      weight: vsize * SAMPLE_WEIGHT_PER_VBYTE
    }
  }
}

export type SampleSankey = {
  feeRate: number
  inputs: Map<string, Utxo>
  outputs: Output[]
  ownAddresses: Set<string>
}

export function toSampleSankey({
  feeRate,
  ownAddresses,
  transaction
}: SampleChartTransaction): SampleSankey {
  const inputs = new Map(
    transaction.vin.map((input) => {
      const { txid, vout } = input.previousOutput
      const utxo: Utxo = {
        keychain: 'external',
        label: input.label,
        txid,
        value: input.value ?? 0,
        vout
      }
      return [`${txid}:${vout}`, utxo]
    })
  )
  const outputs = transaction.vout.map((output, index) => ({
    amount: output.value,
    kind: output.kind,
    label: output.label ?? '',
    localId: `sample-output-${index}`,
    to: output.address
  }))
  return { feeRate, inputs, outputs, ownAddresses }
}

type SampleWalletOptions = {
  seed: number
  transactionCount: number
  spanDays: number
  end: Date
  endHeight: number
  unconfirmedTip?: boolean
}

export type SampleWallet = {
  transactions: Transaction[]
  utxos: Utxo[]
}

type OwnedOutput = Utxo & { address: string }

const RECEIVE_CHANCE = 0.55
const CONSOLIDATION_CHANCE = 0.12
const SELF_SEND_CHANCE = 0.08
const WHALE_CHANCE = 0.05
const RECEIVE_MIN = 5000
const RECEIVE_MAX = 80_000_000
const WHALE_MIN = 300_000_000
const WHALE_MAX = 2_000_000_000
const MAX_CONSOLIDATION_INPUTS = 12
const MIN_SPEND_SHARE = 0.05
const SPEND_SHARE_RANGE = 0.85
const WALLET_FEE_RATE = 8

function walletInput(output: OwnedOutput) {
  return {
    label: output.label,
    previousOutput: { txid: output.txid, vout: output.vout },
    scriptSig: '',
    sequence: SAMPLE_SEQUENCE,
    value: output.value,
    witness: []
  }
}

function pickSpendInputs(random: SampleRandom, unspent: OwnedOutput[]) {
  const consolidate = random() < CONSOLIDATION_CHANCE && unspent.length > 2
  const count = consolidate
    ? Math.min(
        unspent.length,
        2 + Math.floor(random() * MAX_CONSOLIDATION_INPUTS)
      )
    : 1 + Math.floor(random() * Math.min(2, unspent.length))
  const shuffled = unspent.toSorted(() => random() - 0.5)
  return { consolidate, inputs: shuffled.slice(0, count) }
}

export function buildSampleWallet({
  seed,
  transactionCount,
  spanDays,
  end,
  endHeight,
  unconfirmedTip = false
}: SampleWalletOptions): SampleWallet {
  const random = createSampleRandom(seed)
  const unspent: OwnedOutput[] = []
  const transactions: Transaction[] = []
  const stepDays = spanDays / Math.max(1, transactionCount)

  for (const index of Array.from({ length: transactionCount }, (_, i) => i)) {
    const daysAgo = spanDays - index * stepDays
    const timestamp = new Date(end.getTime() - daysAgo * MS_PER_DAY)
    const isTip = unconfirmedTip && index === transactionCount - 1
    const blockHeight = isTip
      ? undefined
      : endHeight - Math.ceil(daysAgo * BLOCKS_PER_DAY)
    const id = sampleTxid(random)
    const label = sampleLabel(random)
    const receive = unspent.length === 0 || random() < RECEIVE_CHANCE

    if (receive) {
      const value =
        random() < WHALE_CHANCE
          ? sampleValue(random, WHALE_MIN, WHALE_MAX)
          : sampleValue(random, RECEIVE_MIN, RECEIVE_MAX)
      const address = sampleAddress(random)
      const vsize = estimateVsize(1, 2)
      const fee = vsize * WALLET_FEE_RATE
      transactions.push({
        blockHeight,
        fee,
        id,
        label,
        lockTimeEnabled: false,
        prices: SAMPLE_PRICES,
        received: value,
        sent: 0,
        size: vsize * 2,
        timestamp,
        type: 'receive',
        vin: [
          {
            previousOutput: { txid: sampleTxid(random), vout: 0 },
            scriptSig: '',
            sequence: SAMPLE_SEQUENCE,
            value: value + fee,
            witness: []
          }
        ],
        vout: [{ address, script: SAMPLE_SCRIPT, value }],
        vsize
      })
      unspent.push({
        address,
        addressTo: address,
        keychain: 'external',
        label,
        timestamp,
        txid: id,
        value,
        vout: 0
      })
      continue
    }

    const { consolidate, inputs } = pickSpendInputs(random, unspent)
    for (const input of inputs) {
      unspent.splice(unspent.indexOf(input), 1)
    }
    const inputTotal = inputs.reduce((sum, input) => sum + input.value, 0)
    const selfSend = consolidate || random() < SELF_SEND_CHANCE
    const vsize = estimateVsize(inputs.length, selfSend ? 1 : 2)
    const fee = vsize * WALLET_FEE_RATE
    const spendable = inputTotal - fee
    const payment = selfSend
      ? spendable
      : Math.max(
          SAMPLE_DUST_LIMIT,
          Math.floor(
            spendable * (MIN_SPEND_SHARE + random() * SPEND_SHARE_RANGE)
          )
        )
    const changeValue = selfSend ? 0 : spendable - payment
    const paymentAddress = sampleAddress(random)
    const changeAddress = sampleAddress(random)
    const hasChange = changeValue >= SAMPLE_DUST_LIMIT
    const vout = [
      { address: paymentAddress, script: SAMPLE_SCRIPT, value: payment },
      ...(hasChange
        ? [
            {
              address: changeAddress,
              kind: 'change' as const,
              script: SAMPLE_SCRIPT,
              value: changeValue
            }
          ]
        : [])
    ]
    const received = (selfSend ? payment : 0) + (hasChange ? changeValue : 0)

    transactions.push({
      blockHeight,
      fee,
      id,
      label,
      lockTimeEnabled: false,
      prices: SAMPLE_PRICES,
      received,
      sent: inputTotal,
      size: vsize * 2,
      timestamp,
      type: 'send',
      vin: inputs.map(walletInput),
      vout,
      vsize
    })
    if (selfSend) {
      unspent.push({
        address: paymentAddress,
        addressTo: paymentAddress,
        keychain: 'internal',
        label,
        timestamp,
        txid: id,
        value: payment,
        vout: 0
      })
    }
    if (hasChange) {
      unspent.push({
        address: changeAddress,
        addressTo: changeAddress,
        keychain: 'internal',
        label,
        timestamp,
        txid: id,
        value: changeValue,
        vout: 1
      })
    }
  }

  return {
    transactions,
    utxos: unspent.map(({ address: _address, ...utxo }) => utxo)
  }
}

const CHANNEL_MIN = 20_000
const CHANNEL_MAX = 50_000_000
const EMPTY_SIDE_CHANCE = 0.15
const CHANNEL_ID_BASE = 871_234_567_890_000_000n

export function buildSampleChannels(
  count: number,
  seed: number
): LightningBubbleChannelRow[] {
  const random = createSampleRandom(seed)
  return Array.from({ length: count }, (_, index) => {
    const capacity = sampleValue(random, CHANNEL_MIN, CHANNEL_MAX)
    const emptySide = random() < EMPTY_SIDE_CHANCE
    const localShare = emptySide ? Math.round(random()) : random()
    const localSats = Math.round(capacity * localShare)
    return {
      chanId: String(CHANNEL_ID_BASE + BigInt(index)),
      localSats,
      peerLabel: `${pick(random, SAMPLE_PEERS)} ${index + 1}`,
      remoteSats: capacity - localSats
    }
  })
}

const LOG_START = Date.UTC(2026, 0, 3, 18, 15, 5)
const LOG_MAX_GAP_MS = 900
const LOG_LONG_CHANCE = 0.1
const LOG_LONG_REPEAT = 6

export function buildSampleLogEntries(
  count: number,
  seed: number
): DevConsoleEntry[] {
  const random = createSampleRandom(seed)
  const clock = { time: LOG_START }
  return Array.from({ length: count }, (_, id) => {
    clock.time += Math.floor(random() * LOG_MAX_GAP_MS)
    const message = pick(random, SAMPLE_LOG_MESSAGES)
    return {
      id,
      level: pick(random, SAMPLE_LOG_LEVELS),
      message:
        random() < LOG_LONG_CHANCE
          ? Array.from({ length: LOG_LONG_REPEAT }, () => message).join(' · ')
          : message,
      scope: pick(random, SAMPLE_LOG_SCOPES),
      time: clock.time
    }
  })
}

const TAG_WORDS = [
  'cold',
  'family',
  'exchange',
  'kyc-free',
  'donation',
  'savings',
  'merchant',
  'mining-payout-from-a-very-long-pool-name'
]

export function buildSampleTags(count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) => `${TAG_WORDS[index % TAG_WORDS.length]}-${index + 1}`
  )
}
