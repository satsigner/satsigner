/**
 * Reference data captured from Sparrow UI (Signet, privacy send 4,687 sats @ 0.5
 * sats/vB). Values in sats. Full txids filled where resolved via esplora scan.
 */
type SparrowUtxoRef = {
  label?: string
  prefix: string
  txid?: string
  value: number
  vout: number
}

/** All 16 UTXOs shown in Sparrow's UTXOs tab (sorted by value desc). */
const SPARROW_UTXO_CATALOG: SparrowUtxoRef[] = [
  { prefix: 'c95285a7', value: 204_482, vout: 1 },
  {
    prefix: '354c99e4',
    txid: '354c99e4f7839b9fa0118564968ce4948f378d12cfc342419f8eb07481f3ef74',
    value: 186_443,
    vout: 1
  },
  { prefix: 'dde638d7', value: 163_497, vout: 1 },
  {
    prefix: 'cb145a00',
    txid: 'cb145a00c35b6e40eab4594f79fea86bc1a9c8876e5cacae89fb85652d23049a',
    value: 5846,
    vout: 0
  },
  { prefix: 'd2f87789', value: 4166, vout: 1 },
  {
    prefix: '3bb6edea',
    txid: '3bb6edeaaf08cd423734905c735122d5fdd5f5ad7dda8b7b6c2db8bbe508d64f',
    value: 3362,
    vout: 1
  },
  {
    prefix: 'fdd2064e',
    txid: 'fdd2064e1ee7810c5264ea676b759689ecb866b45b4d7e7e52b78502cd864f75',
    value: 3016,
    vout: 0
  },
  {
    prefix: '85bb749b',
    txid: '85bb749bd821291a0a2509c8b6fb95f4376a1c0d8f6117f45c5fd6d7603020e8',
    value: 2743,
    vout: 0
  },
  {
    label: 'aaa 2 (received)',
    prefix: '2f80f257',
    txid: '2f80f2578f5e252c1c66de2e8744f421f0d619ff0610d164b20428c3c8403536',
    value: 2121,
    vout: 0
  },
  {
    prefix: 'fdd2064e',
    txid: 'fdd2064e1ee7810c5264ea676b759689ecb866b45b4d7e7e52b78502cd864f75',
    value: 1592,
    vout: 1
  },
  {
    prefix: '8726c871',
    txid: '8726c871ef730b0794664b8292d84cfbff514256c746ad88ba33b384bed880de',
    value: 1501,
    vout: 1
  },
  {
    prefix: '5ba6a157',
    txid: '5ba6a157ace46f4683c21c3323e98f4915ebf84bfdc50c84e4249b13e941c5f4',
    value: 1345,
    vout: 1
  },
  {
    prefix: '5ba6a157',
    txid: '5ba6a157ace46f4683c21c3323e98f4915ebf84bfdc50c84e4249b13e941c5f4',
    value: 692,
    vout: 0
  },
  {
    prefix: '405267c3',
    txid: '405267c3c661930e903732a05d4388ca46cb960ef796c5e5d2b85865edbf15f6',
    value: 691,
    vout: 1
  },
  {
    prefix: '9ae15fbd',
    txid: '9ae15fbd3218b85a3b72864c198313c83e91369ffa71b26244bd638dc33ca5c9',
    value: 546,
    vout: 0
  },
  {
    prefix: 'cb145a00',
    txid: 'cb145a00c35b6e40eab4594f79fea86bc1a9c8876e5cacae89fb85652d23049a',
    value: 410,
    vout: 1
  }
]

/** STONEWALL selection after removing a large input (Sparrow privacy diagram). */
const SPARROW_STONEWALL_SELECTION: SparrowUtxoRef[] = [
  {
    prefix: 'cb145a00',
    txid: 'cb145a00c35b6e40eab4594f79fea86bc1a9c8876e5cacae89fb85652d23049a',
    value: 5846,
    vout: 0
  },
  {
    prefix: '5ba6a157',
    txid: '5ba6a157ace46f4683c21c3323e98f4915ebf84bfdc50c84e4249b13e941c5f4',
    value: 692,
    vout: 0
  },
  {
    prefix: 'fdd2064e',
    txid: 'fdd2064e1ee7810c5264ea676b759689ecb866b45b4d7e7e52b78502cd864f75',
    value: 3016,
    vout: 0
  },
  {
    prefix: '5ba6a157',
    txid: '5ba6a157ace46f4683c21c3323e98f4915ebf84bfdc50c84e4249b13e941c5f4',
    value: 1345,
    vout: 1
  },
  {
    prefix: '405267c3',
    txid: '405267c3c661930e903732a05d4388ca46cb960ef796c5e5d2b85865edbf15f6',
    value: 691,
    vout: 1
  }
]

const SPARROW_STONEWALL_FEE = 236

function outpointKey(prefix: string, vout: number, value: number) {
  return `${prefix}:${vout}:${value}`
}

function toOutpoint(ref: SparrowUtxoRef) {
  if (ref.txid) {
    return `${ref.txid}:${ref.vout}`
  }
  return `${ref.prefix}…:${ref.vout}`
}

function matchUtxoToRef(
  utxo: { txid: string; vout: number; value: number },
  ref: SparrowUtxoRef
) {
  return (
    utxo.txid.startsWith(ref.prefix) &&
    utxo.vout === ref.vout &&
    utxo.value === ref.value
  )
}

export {
  matchUtxoToRef,
  outpointKey,
  SPARROW_STONEWALL_FEE,
  SPARROW_STONEWALL_SELECTION,
  SPARROW_UTXO_CATALOG,
  toOutpoint
}
export type { SparrowUtxoRef }
