import { type DevConsoleEntry } from '@/types/models/DevConsole'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type LightningBubbleChannelRow } from '@/utils/lightningChannelsBubbleLayout'

export const DESIGN_FEATURE_IDS = [
  'sankey',
  'transactionChart',
  'utxoChart',
  'decoded',
  'multisigSelector',
  'seedWordInput',
  'autocomplete',
  'lightningNode',
  'transactionCard',
  'historyChart',
  'pinInput',
  'devConsole'
] as const

export type DesignFeatureId = (typeof DESIGN_FEATURE_IDS)[number]

export function isDesignFeatureId(value: unknown): value is DesignFeatureId {
  return DESIGN_FEATURE_IDS.some((id) => id === value)
}

export const DESIGN_SAMPLE_ADDRESS =
  'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
export const DESIGN_SAMPLE_TXID =
  'f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16'
export const DESIGN_SAMPLE_XPUB =
  'xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWKiKrhko4egpiMZbpiaQL2jkwSB1icqYh2cfDfVxdx4df189oLKnC5fSwqPfgyP3hooxujYzAu3fDVmz'
export const DESIGN_SAMPLE_FINGERPRINT = '73c5da0a'
export const DESIGN_SAMPLE_AMOUNT = 1_234_567
export const DESIGN_SAMPLE_SMALL_AMOUNT = 2100
export const DESIGN_SAMPLE_LARGE_AMOUNT = 2_100_000_000
export const DESIGN_SAMPLE_SEED_WORDS = [
  'abandon',
  'ability',
  'able',
  'about',
  'above',
  'absent',
  'absorb',
  'abstract',
  'absurd',
  'abuse',
  'access',
  'accident'
]

export const DESIGN_SAMPLE_TX_HEX =
  '0200000000010137131ff2dc9991b6430ba28974b0fc5a3317a6894c00bf0ce2b9f630f7404cca0200000000ffffffff0144e6000000000000160014cc5159408ffdbb39adfd5ed60ac49da7d18a4f4a02483045022100d3727f1e3620114749b9ff8a12a8e55536fa2db45c772dd50d81c46b7a7cf1b60220040f2fb0856f066ddae63f0cef32ed969573e84a17a91b267cafca3f34f5b415012103ef32354a64ce83ff21ed50bea8027e88c13511003ce9a62210956063469373a900000000'
export const DESIGN_SAMPLE_SCRIPT_HEX =
  '0014cc5159408ffdbb39adfd5ed60ac49da7d18a4f4a'

export const DESIGN_SAMPLE_TAGS = [
  'exchange',
  'kyc-free',
  'savings',
  'donation'
]

export const DESIGN_SAMPLE_BLOCK_HEIGHT = 850_100
export const DESIGN_SAMPLE_FEE_RATE = 12
export const DESIGN_SAMPLE_MULTISIG_MAX_KEYS = 12

const SAMPLE_PRICES = { USD: 65_000 }
const SAMPLE_SCRIPT = '0014cc5159408ffdbb39adfd5ed60ac49da7d18a4f4a'

const ADDRESS_RECEIVE_A = 'bc1q9h7garjjpvgd9jx6dfwdhqqrw3mdxwzqk7dzjl'
const ADDRESS_RECEIVE_B = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'
const ADDRESS_RECEIVE_C = 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde'
const ADDRESS_CHANGE = 'bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h'
const ADDRESS_EXTERNAL =
  'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3'

const TXID_RECEIVE_A =
  'a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d'
const TXID_RECEIVE_B =
  'b6f6991d03df0e2e04dafffcd6bc418aac66049e2cd74b80f14ac86db1e3f0da'
const TXID_SPEND =
  'c3ab3a1b7e5d29a1e4e1f9b1cc2b0e0b5b8dd8e0b0c4a1f2d1e6f7a8b9c0d1e2'
const TXID_RECEIVE_C =
  'd4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3'

export const DESIGN_SAMPLE_OWN_ADDRESSES = new Set([
  ADDRESS_RECEIVE_A,
  ADDRESS_RECEIVE_B,
  ADDRESS_RECEIVE_C,
  ADDRESS_CHANGE
])

export const DESIGN_SAMPLE_TRANSACTIONS: Transaction[] = [
  {
    blockHeight: 840_000,
    fee: 1410,
    id: TXID_RECEIVE_A,
    label: 'Salary',
    lockTimeEnabled: false,
    prices: SAMPLE_PRICES,
    received: 500_000,
    sent: 0,
    size: 222,
    timestamp: new Date('2024-04-20T00:09:27Z'),
    type: 'receive',
    vin: [
      {
        previousOutput: { txid: TXID_RECEIVE_B, vout: 3 },
        scriptSig: '',
        sequence: 0xff_ff_ff_fd,
        value: 1_501_410,
        witness: []
      }
    ],
    vout: [
      { address: ADDRESS_RECEIVE_A, script: SAMPLE_SCRIPT, value: 500_000 },
      { address: ADDRESS_EXTERNAL, script: SAMPLE_SCRIPT, value: 1_000_000 }
    ],
    vsize: 141
  },
  {
    blockHeight: 845_000,
    fee: 2820,
    id: TXID_RECEIVE_B,
    label: 'Exchange withdrawal',
    lockTimeEnabled: false,
    prices: SAMPLE_PRICES,
    received: 1_200_000,
    sent: 0,
    size: 222,
    timestamp: new Date('2024-05-24T10:12:00Z'),
    type: 'receive',
    vin: [
      {
        previousOutput: { txid: TXID_RECEIVE_C, vout: 1 },
        scriptSig: '',
        sequence: 0xff_ff_ff_fd,
        value: 1_202_820,
        witness: []
      }
    ],
    vout: [
      { address: ADDRESS_RECEIVE_B, script: SAMPLE_SCRIPT, value: 1_200_000 }
    ],
    vsize: 141
  },
  {
    blockHeight: 848_200,
    fee: 5000,
    id: TXID_SPEND,
    label: 'Coffee roaster',
    lockTimeEnabled: false,
    prices: SAMPLE_PRICES,
    received: 195_000,
    sent: 500_000,
    size: 222,
    timestamp: new Date('2024-06-15T15:30:00Z'),
    type: 'send',
    vin: [
      {
        label: 'Salary',
        previousOutput: { txid: TXID_RECEIVE_A, vout: 0 },
        scriptSig: '',
        sequence: 0xff_ff_ff_fd,
        value: 500_000,
        witness: []
      }
    ],
    vout: [
      { address: ADDRESS_EXTERNAL, script: SAMPLE_SCRIPT, value: 300_000 },
      {
        address: ADDRESS_CHANGE,
        kind: 'change',
        script: SAMPLE_SCRIPT,
        value: 195_000
      }
    ],
    vsize: 141
  },
  {
    blockHeight: 850_000,
    fee: 1100,
    id: TXID_RECEIVE_C,
    label: 'Zap payout',
    lockTimeEnabled: false,
    prices: SAMPLE_PRICES,
    received: 80_000,
    sent: 0,
    size: 222,
    timestamp: new Date('2024-07-02T08:45:00Z'),
    type: 'receive',
    vin: [
      {
        previousOutput: { txid: TXID_SPEND, vout: 0 },
        scriptSig: '',
        sequence: 0xff_ff_ff_fd,
        value: 81_100,
        witness: []
      }
    ],
    vout: [
      { address: ADDRESS_RECEIVE_C, script: SAMPLE_SCRIPT, value: 80_000 }
    ],
    vsize: 141
  }
]

export const DESIGN_SAMPLE_UTXOS: Utxo[] = [
  {
    addressTo: ADDRESS_RECEIVE_B,
    keychain: 'external',
    label: 'Exchange withdrawal',
    timestamp: new Date('2024-05-24T10:12:00Z'),
    txid: TXID_RECEIVE_B,
    value: 1_200_000,
    vout: 0
  },
  {
    addressTo: ADDRESS_CHANGE,
    keychain: 'internal',
    label: 'Change',
    timestamp: new Date('2024-06-15T15:30:00Z'),
    txid: TXID_SPEND,
    value: 195_000,
    vout: 1
  },
  {
    addressTo: ADDRESS_RECEIVE_C,
    keychain: 'external',
    label: 'Zap payout',
    timestamp: new Date('2024-07-02T08:45:00Z'),
    txid: TXID_RECEIVE_C,
    value: 80_000,
    vout: 0
  }
]

export const DESIGN_SAMPLE_SANKEY_OUTPUTS = [
  {
    amount: 900_000,
    label: 'Hardware vendor',
    localId: 'design-output-payment',
    to: ADDRESS_EXTERNAL
  },
  {
    amount: 492_000,
    label: 'Change',
    localId: 'design-output-change',
    to: ADDRESS_CHANGE
  }
]

export const DESIGN_SAMPLE_LIGHTNING_CHANNELS: LightningBubbleChannelRow[] = [
  {
    chanId: '871234567890123776',
    localSats: 4_200_000,
    peerLabel: 'ACINQ',
    remoteSats: 800_000
  },
  {
    chanId: '871234567890123777',
    localSats: 1_500_000,
    peerLabel: 'Voltage',
    remoteSats: 1_500_000
  },
  {
    chanId: '871234567890123778',
    localSats: 250_000,
    peerLabel: 'WalletOfSatoshi',
    remoteSats: 1_750_000
  },
  {
    chanId: '871234567890123779',
    localSats: 600_000,
    peerLabel: 'Kraken',
    remoteSats: 400_000
  },
  {
    chanId: '871234567890123780',
    localSats: 90_000,
    peerLabel: 'LNBig',
    remoteSats: 910_000
  }
]

const DESIGN_SAMPLE_LOG_START = Date.UTC(2026, 0, 3, 18, 15, 5)
const DESIGN_SAMPLE_LOG_INTERVAL_MS = 137

const DESIGN_SAMPLE_LOG_LINES: Pick<
  DevConsoleEntry,
  'level' | 'message' | 'scope'
>[] = [
  { level: 'step', message: 'hydrate stores', scope: 'startup' },
  { level: 'info', message: 'loaded 3 accounts', scope: 'accounts' },
  { level: 'step', message: 'connect electrum', scope: 'startup' },
  {
    level: 'info',
    message: 'ssl://electrum.blockstream.info:50002',
    scope: 'electrum'
  },
  { level: 'warn', message: 'fee estimate stale, retrying', scope: 'fees' },
  { level: 'info', message: 'synced 42 transactions', scope: 'sync' },
  { level: 'error', message: 'nostr relay timed out', scope: 'nostr' }
]

export const DESIGN_SAMPLE_DEV_CONSOLE_ENTRIES: DevConsoleEntry[] =
  DESIGN_SAMPLE_LOG_LINES.map((entry, index) => ({
    ...entry,
    id: index,
    time: DESIGN_SAMPLE_LOG_START + index * DESIGN_SAMPLE_LOG_INTERVAL_MS
  }))

export const DESIGN_SAMPLE_DEV_CONSOLE_PAUSED_STEPS = ['load accounts']
