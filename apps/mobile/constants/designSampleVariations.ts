import {
  DESIGN_SAMPLE_BLOCK_HEIGHT,
  DESIGN_SAMPLE_DEV_CONSOLE_ENTRIES,
  DESIGN_SAMPLE_FEE_RATE,
  DESIGN_SAMPLE_LIGHTNING_CHANNELS,
  DESIGN_SAMPLE_OWN_ADDRESSES,
  DESIGN_SAMPLE_SANKEY_OUTPUTS,
  DESIGN_SAMPLE_TAGS,
  DESIGN_SAMPLE_TRANSACTIONS,
  DESIGN_SAMPLE_UTXOS,
  type DesignFeatureId
} from '@/constants/designSystem'
import type { DevConsoleEntry } from '@/types/models/DevConsole'
import type { Transaction } from '@/types/models/Transaction'
import type { Utxo } from '@/types/models/Utxo'
import {
  buildSampleChannels,
  buildSampleChartTransaction,
  buildSampleLogEntries,
  buildSampleTags,
  buildSampleUtxos,
  buildSampleWallet,
  type SampleChartTransaction,
  type SampleSankey,
  type SampleWallet,
  toSampleSankey
} from '@/utils/designSamples'
import type { LightningBubbleChannelRow } from '@/utils/lightningChannelsBubbleLayout'
import { getTransactionRunningBalances } from '@/utils/walletOwnership'

export type DesignSampleSetName =
  | 'coinjoin'
  | 'current'
  | 'heavy'
  | 'long'
  | 'manyBig'
  | 'manySmall'
  | 'minimal'
  | 'payjoin'
  | 'short'
  | 'standard'

export const DESIGN_SAMPLE_SET_LABEL_KEYS: Record<DesignSampleSetName, string> =
  {
    coinjoin: 'setCoinjoin',
    current: 'setCurrent',
    heavy: 'setHeavy',
    long: 'setLong',
    manyBig: 'setManyBig',
    manySmall: 'setManySmall',
    minimal: 'setMinimal',
    payjoin: 'setPayjoin',
    short: 'setShort',
    standard: 'setStandard'
  }

export type DesignSampleSet<T> = {
  name: DesignSampleSetName
  data: T
}

const SATS_PER_BTC = 100_000_000
const WALLET_END = new Date('2024-07-02T08:45:00Z')

const STANDARD_SPEND = DESIGN_SAMPLE_TRANSACTIONS.find(
  (transaction) => transaction.type === 'send'
)

const STANDARD_INTERNAL_ADDRESSES = new Set(
  DESIGN_SAMPLE_UTXOS.filter((utxo) => utxo.keychain === 'internal').flatMap(
    (utxo) => (utxo.addressTo ? [utxo.addressTo] : [])
  )
)

export type DesignSankeySample =
  | ({ chart: 'current' } & SampleSankey)
  | ({ chart: 'transaction' } & SampleChartTransaction)

const STANDARD_SANKEY: DesignSankeySample = {
  chart: 'current',
  feeRate: DESIGN_SAMPLE_FEE_RATE,
  inputs: new Map(
    DESIGN_SAMPLE_UTXOS.slice(0, 2).map((utxo) => [
      `${utxo.txid}:${utxo.vout}`,
      utxo
    ])
  ),
  outputs: DESIGN_SAMPLE_SANKEY_OUTPUTS,
  ownAddresses: DESIGN_SAMPLE_OWN_ADDRESSES
}

const SANKEY_MINIMAL = buildSampleChartTransaction({
  inputCount: 1,
  outputCount: 0,
  seed: 11
})
const SANKEY_HEAVY = buildSampleChartTransaction({
  feeRate: 85,
  inputCount: 12,
  inputMax: 4 * SATS_PER_BTC,
  inputMin: 546,
  outputCount: 20,
  seed: 12
})
const SANKEY_PAYJOIN = buildSampleChartTransaction({
  counterpartyInputCount: 1,
  inputCount: 2,
  outputCount: 1,
  seed: 13
})
const SANKEY_COINJOIN = buildSampleChartTransaction({
  counterpartyInputCount: 49,
  equalOutputValue: 5_000_000,
  inputCount: 50,
  inputMax: 30_000_000,
  outputCount: 50,
  seed: 14
})

export const DESIGN_SANKEY_SETS: DesignSampleSet<DesignSankeySample>[] = [
  { data: STANDARD_SANKEY, name: 'standard' },
  {
    data: { chart: 'current', ...toSampleSankey(SANKEY_MINIMAL) },
    name: 'minimal'
  },
  {
    data: { chart: 'current', ...toSampleSankey(SANKEY_HEAVY) },
    name: 'heavy'
  },
  { data: { chart: 'transaction', ...SANKEY_PAYJOIN }, name: 'payjoin' },
  { data: { chart: 'transaction', ...SANKEY_COINJOIN }, name: 'coinjoin' }
]

export const DESIGN_TRANSACTION_CHART_SETS: DesignSampleSet<SampleChartTransaction>[] =
  [
    ...(STANDARD_SPEND
      ? [
          {
            data: {
              feeRate: DESIGN_SAMPLE_FEE_RATE,
              internalAddresses: STANDARD_INTERNAL_ADDRESSES,
              ownAddresses: DESIGN_SAMPLE_OWN_ADDRESSES,
              ownedOutpoints: new Set<string>(),
              transaction: STANDARD_SPEND
            },
            name: 'standard' as const
          }
        ]
      : []),
    {
      data: buildSampleChartTransaction({
        inputCount: 1,
        outputCount: 0,
        seed: 21
      }),
      name: 'minimal'
    },
    {
      data: buildSampleChartTransaction({
        inputCount: 25,
        inputMin: 546,
        outputCount: 30,
        seed: 22
      }),
      name: 'heavy'
    }
  ]

export type DesignUtxoSample = {
  utxos: Utxo[]
  total: number
}

function utxoSample(utxos: Utxo[]): DesignUtxoSample {
  return { total: utxos.reduce((sum, utxo) => sum + utxo.value, 0), utxos }
}

export const DESIGN_UTXO_SETS: DesignSampleSet<DesignUtxoSample>[] = [
  { data: utxoSample(DESIGN_SAMPLE_UTXOS), name: 'standard' },
  { data: utxoSample(DESIGN_SAMPLE_UTXOS.slice(0, 1)), name: 'minimal' },
  {
    data: utxoSample(
      buildSampleUtxos({
        count: 150,
        max: 5 * SATS_PER_BTC,
        min: 546,
        seed: 31
      })
    ),
    name: 'heavy'
  },
  {
    data: utxoSample(
      buildSampleUtxos({ count: 200, max: 50_000, min: 546, seed: 32 })
    ),
    name: 'manySmall'
  },
  {
    data: utxoSample(
      buildSampleUtxos({
        count: 40,
        max: 20 * SATS_PER_BTC,
        min: SATS_PER_BTC,
        seed: 33
      })
    ),
    name: 'manyBig'
  }
]

export const DESIGN_HISTORY_SETS: DesignSampleSet<SampleWallet>[] = [
  {
    data: {
      transactions: DESIGN_SAMPLE_TRANSACTIONS,
      utxos: DESIGN_SAMPLE_UTXOS
    },
    name: 'current'
  },
  {
    data: buildSampleWallet({
      end: WALLET_END,
      endHeight: DESIGN_SAMPLE_BLOCK_HEIGHT,
      seed: 41,
      spanDays: 5,
      transactionCount: 3
    }),
    name: 'short'
  },
  {
    data: buildSampleWallet({
      end: WALLET_END,
      endHeight: DESIGN_SAMPLE_BLOCK_HEIGHT,
      seed: 42,
      spanDays: 1100,
      transactionCount: 300,
      unconfirmedTip: true
    }),
    name: 'long'
  }
]

export type DesignChannelSample = {
  rows: LightningBubbleChannelRow[]
  total: number
}

function channelSample(rows: LightningBubbleChannelRow[]): DesignChannelSample {
  return {
    rows,
    total: rows.reduce(
      (sum, channel) => sum + channel.localSats + channel.remoteSats,
      0
    )
  }
}

export const DESIGN_CHANNEL_SETS: DesignSampleSet<DesignChannelSample>[] = [
  { data: channelSample(DESIGN_SAMPLE_LIGHTNING_CHANNELS), name: 'standard' },
  {
    data: channelSample([
      {
        chanId: '871234567890123700',
        localSats: 2_000_000,
        peerLabel: 'ACINQ',
        remoteSats: 0
      }
    ]),
    name: 'minimal'
  },
  { data: channelSample(buildSampleChannels(60, 51)), name: 'heavy' }
]

export const DESIGN_LOG_SETS: DesignSampleSet<DevConsoleEntry[]>[] = [
  { data: DESIGN_SAMPLE_DEV_CONSOLE_ENTRIES, name: 'standard' },
  { data: [], name: 'minimal' },
  { data: buildSampleLogEntries(500, 61), name: 'heavy' }
]

export const DESIGN_FEATURE_SET_NAMES: Partial<
  Record<DesignFeatureId, DesignSampleSetName[]>
> = {
  devConsole: DESIGN_LOG_SETS.map((set) => set.name),
  historyChart: DESIGN_HISTORY_SETS.map((set) => set.name),
  lightningNode: DESIGN_CHANNEL_SETS.map((set) => set.name),
  nostrChat: ['standard', 'minimal', 'heavy'],
  nostrMessageDetail: ['standard', 'minimal', 'heavy'],
  nostrReactions: ['standard', 'minimal', 'heavy'],
  sankey: DESIGN_SANKEY_SETS.map((set) => set.name),
  transactionChart: DESIGN_TRANSACTION_CHART_SETS.map((set) => set.name),
  utxoChart: DESIGN_UTXO_SETS.map((set) => set.name)
}

const [RECEIVE_BASE] = DESIGN_SAMPLE_TRANSACTIONS
const SEND_BASE = STANDARD_SPEND ?? RECEIVE_BASE
const STANDARD_BALANCES = getTransactionRunningBalances(
  DESIGN_SAMPLE_TRANSACTIONS
)
const SAMPLE_BALANCE = 2_475_000
const LONG_AMOUNT = 2_099_999_997_690

export type DesignTransactionCardState = {
  title: string
  count?: number
  expand: boolean
  transaction: Transaction
  walletBalance?: number
}

function confirmedAt(confirmations: number) {
  return DESIGN_SAMPLE_BLOCK_HEIGHT - confirmations + 1
}

function withChanges(
  base: Transaction,
  changes: Partial<Transaction>
): Transaction {
  return { ...base, ...changes, id: `${base.id}-${JSON.stringify(changes)}` }
}

const CONFIRMATION_COUNTS = [1, 2, 6, 1000]

export const DESIGN_TRANSACTION_CARD_STATES: DesignTransactionCardState[] = [
  {
    expand: false,
    title: 'cardUnconfirmed',
    transaction: withChanges(RECEIVE_BASE, { blockHeight: undefined }),
    walletBalance: SAMPLE_BALANCE
  },
  ...CONFIRMATION_COUNTS.map((count) => ({
    count,
    expand: false,
    title: 'cardConfirmations',
    transaction: withChanges(RECEIVE_BASE, { blockHeight: confirmedAt(count) }),
    walletBalance: SAMPLE_BALANCE
  })),
  {
    expand: false,
    title: 'cardReceive',
    transaction: RECEIVE_BASE,
    walletBalance: STANDARD_BALANCES.get(RECEIVE_BASE.id)
  },
  {
    expand: false,
    title: 'cardSend',
    transaction: SEND_BASE,
    walletBalance: STANDARD_BALANCES.get(SEND_BASE.id)
  },
  {
    expand: false,
    title: 'cardBalanceUp',
    transaction: RECEIVE_BASE,
    walletBalance: SAMPLE_BALANCE
  },
  {
    expand: false,
    title: 'cardBalanceDown',
    transaction: SEND_BASE,
    walletBalance: SAMPLE_BALANCE
  },
  {
    expand: false,
    title: 'cardNoBalance',
    transaction: RECEIVE_BASE
  },
  {
    expand: false,
    title: 'cardShortAmount',
    transaction: withChanges(RECEIVE_BASE, { received: 546 }),
    walletBalance: SAMPLE_BALANCE
  },
  {
    expand: false,
    title: 'cardLongAmount',
    transaction: withChanges(RECEIVE_BASE, { received: LONG_AMOUNT }),
    walletBalance: LONG_AMOUNT
  },
  {
    expand: false,
    title: 'cardLabelTags',
    transaction: withChanges(RECEIVE_BASE, {
      label: 'Salary #income #monthly'
    }),
    walletBalance: SAMPLE_BALANCE
  },
  {
    expand: false,
    title: 'cardLabelOnly',
    transaction: withChanges(RECEIVE_BASE, { label: 'Salary' }),
    walletBalance: SAMPLE_BALANCE
  },
  {
    expand: false,
    title: 'cardTagsOnly',
    transaction: withChanges(RECEIVE_BASE, { label: '#cold #savings' }),
    walletBalance: SAMPLE_BALANCE
  },
  {
    expand: false,
    title: 'cardNoLabel',
    transaction: withChanges(RECEIVE_BASE, { label: '' }),
    walletBalance: SAMPLE_BALANCE
  },
  {
    expand: true,
    title: 'cardExpandedReceive',
    transaction: RECEIVE_BASE,
    walletBalance: SAMPLE_BALANCE
  },
  {
    expand: true,
    title: 'cardExpandedSend',
    transaction: SEND_BASE,
    walletBalance: SAMPLE_BALANCE
  }
]

export const DESIGN_TAG_STATES = [
  { selected: 0, tags: [], title: 'tagsNone' },
  { selected: 1, tags: DESIGN_SAMPLE_TAGS, title: 'tagsFew' },
  { selected: 12, tags: buildSampleTags(30), title: 'tagsMany' }
]

export const DESIGN_WORD_STATES = [
  { title: 'wordsNoMatch', wordStart: 'xyz' },
  { title: 'wordsOneMatch', wordStart: 'zoo' },
  { title: 'wordsManyMatches', wordStart: 'a' }
]
