/**
 * Frozen Signet wallet UTXO pool for offline STONEWALL parity tests.
 *
 * 12 entries resolved from mempool Esplora (Jul 2026). Four Sparrow-only UTXOs
 * use estimated address indices — refresh after Sparrow fully syncs on the same
 * backend (see STONEWALL-SPARROW-PARITY.md).
 */
import { type Address } from '@/types/models/Address'
import { type Utxo } from '@/types/models/Utxo'

type FrozenUtxo = Utxo & {
  addressIndex: number
}

type FrozenPoolEntry = {
  addressIndex: number
  keychain: Address['keychain']
  txid: string
  value: number
  vout: number
  /** true when address index is inferred, not esplora-resolved */
  estimated?: boolean
}

const FROZEN_POOL_ENTRIES: FrozenPoolEntry[] = [
  {
    addressIndex: 2,
    estimated: true,
    keychain: 'external',
    txid: 'c95285a7311111111111111111111111111111111111111111111111111111111',
    value: 204_482,
    vout: 1
  },
  {
    addressIndex: 27,
    keychain: 'external',
    txid: '354c99e4f7839b9fa0118564968ce4948f378d12cfc342419f8eb07481f3ef74',
    value: 186_443,
    vout: 1
  },
  {
    addressIndex: 3,
    estimated: true,
    keychain: 'external',
    txid: 'dde638d7111111111111111111111111111111111111111111111111111111111',
    value: 163_497,
    vout: 1
  },
  {
    addressIndex: 20,
    keychain: 'external',
    txid: 'cb145a00c35b6e40eab4594f79fea86bc1a9c8876e5cacae89fb85652d23049a',
    value: 5846,
    vout: 0
  },
  {
    addressIndex: 74,
    estimated: true,
    keychain: 'external',
    txid: 'd2f8778911111111111111111111111111111111111111111111111111111111',
    value: 4166,
    vout: 1
  },
  {
    addressIndex: 73,
    keychain: 'external',
    txid: '3bb6edeaaf08cd423734905c735122d5fdd5f5ad7dda8b7b6c2db8bbe508d64f',
    value: 3362,
    vout: 1
  },
  {
    addressIndex: 80,
    keychain: 'external',
    txid: 'fdd2064e1ee7810c5264ea676b759689ecb866b45b4d7e7e52b78502cd864f75',
    value: 3016,
    vout: 0
  },
  {
    addressIndex: 36,
    keychain: 'internal',
    txid: '85bb749bd821291a0a2509c8b6fb95f4376a1c0d8f6117f45c5fd6d7603020e8',
    value: 2743,
    vout: 0
  },
  {
    addressIndex: 9,
    keychain: 'external',
    txid: '2f80f2578f5e252c1c66de2e8744f421f0d619ff0610d164b20428c3c8403536',
    value: 2121,
    vout: 0
  },
  {
    addressIndex: 43,
    keychain: 'internal',
    txid: 'fdd2064e1ee7810c5264ea676b759689ecb866b45b4d7e7e52b78502cd864f75',
    value: 1592,
    vout: 1
  },
  {
    addressIndex: 40,
    keychain: 'internal',
    txid: '8726c871ef730b0794664b8292d84cfbff514256c746ad88ba33b384bed880de',
    value: 1501,
    vout: 1
  },
  {
    addressIndex: 26,
    keychain: 'external',
    txid: '5ba6a157ace46f4683c21c3323e98f4915ebf84bfdc50c84e4249b13e941c5f4',
    value: 1345,
    vout: 1
  },
  {
    addressIndex: 26,
    keychain: 'external',
    txid: '5ba6a157ace46f4683c21c3323e98f4915ebf84bfdc50c84e4249b13e941c5f4',
    value: 692,
    vout: 0
  },
  {
    addressIndex: 78,
    keychain: 'external',
    txid: '405267c3c661930e903732a05d4388ca46cb960ef796c5e5d2b85865edbf15f6',
    value: 691,
    vout: 1
  },
  {
    addressIndex: 67,
    keychain: 'external',
    txid: '9ae15fbd3218b85a3b72864c198313c83e91369ffa71b26244bd638dc33ca5c9',
    value: 546,
    vout: 0
  },
  {
    addressIndex: 42,
    keychain: 'internal',
    txid: 'cb145a00c35b6e40eab4594f79fea86bc1a9c8876e5cacae89fb85652d23049a',
    value: 410,
    vout: 1
  }
]

function p2wpkhPlaceholder(index: number, keychain: Address['keychain']) {
  const chain = keychain === 'internal' ? '1' : '0'
  return `tb1q${chain}${index.toString().padStart(37, '0')}`
}

function buildFrozenSignetPool() {
  const addresses: Address[] = []
  const addressKeys = new Set<string>()

  for (const entry of FROZEN_POOL_ENTRIES) {
    const key = `${entry.keychain}:${entry.addressIndex}`
    if (addressKeys.has(key)) {
      continue
    }
    addressKeys.add(key)
    addresses.push({
      address: p2wpkhPlaceholder(entry.addressIndex, entry.keychain),
      index: entry.addressIndex,
      keychain: entry.keychain,
      label: '',
      summary: { balance: 0, satsInMempool: 0, transactions: 0, utxos: 0 },
      transactions: [],
      utxos: []
    })
  }

  const utxos: FrozenUtxo[] = FROZEN_POOL_ENTRIES.map((entry) => ({
    addressIndex: entry.addressIndex,
    addressTo: p2wpkhPlaceholder(entry.addressIndex, entry.keychain),
    keychain: entry.keychain,
    label: '',
    txid: entry.txid,
    value: entry.value,
    vout: entry.vout
  }))

  return { addresses, utxos }
}

export { buildFrozenSignetPool, FROZEN_POOL_ENTRIES }
export type { FrozenUtxo }
