/**
 * Reference data from Sparrow UI (Signet, Jul 2026). Privacy send 4,687 sats @
 * ~1 sat/vB on own signet node. Values in sats.
 */
type SparrowUtxoRef = {
  label?: string
  prefix: string
  txid?: string
  value: number
  vout: number
}

/** All 18 UTXOs shown in Sparrow's UTXOs tab (sorted by value desc). */
const SPARROW_UTXO_CATALOG: SparrowUtxoRef[] = [
  {
    prefix: '354c99e4',
    txid: '354c99e4f7839b9fa0118564968ce4948f378d12cfc342419f8eb07481f3ef74',
    value: 186_443,
    vout: 1
  },
  {
    prefix: '5d13cf36',
    txid: '5d13cf36547ee4e85ec1de71c8dc5c95bd659a0f951b2e3267c96e0a163379d2',
    value: 158_357,
    vout: 1
  },
  {
    prefix: '98981d2d',
    txid: '98981d2da372b6a98002ffba6167c5d2e551ca19cf33b99f890b793a5c19d8cc',
    value: 143_565,
    vout: 0
  },
  {
    prefix: '98981d2d',
    txid: '98981d2da372b6a98002ffba6167c5d2e551ca19cf33b99f890b793a5c19d8cc',
    value: 64_875,
    vout: 1
  },
  {
    prefix: '250d9673',
    txid: '250d96736986b32b1b544d9b33a50a1189919755c953c064278915ae0fa3ebc0',
    value: 3206,
    vout: 0
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
    prefix: '83c0cc08',
    txid: '83c0cc0895e40a9837860b3e06064f12da763b4c5b6e9f8ec125f657066f7771',
    value: 2295,
    vout: 3
  },
  {
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
    prefix: '5ba6a157',
    txid: '5ba6a157ace46f4683c21c3323e98f4915ebf84bfdc50c84e4249b13e941c5f4',
    value: 1345,
    vout: 1
  },
  {
    prefix: '83c0cc08',
    txid: '83c0cc0895e40a9837860b3e06064f12da763b4c5b6e9f8ec125f657066f7771',
    value: 1000,
    vout: 1
  },
  {
    prefix: '83c0cc08',
    txid: '83c0cc0895e40a9837860b3e06064f12da763b4c5b6e9f8ec125f657066f7771',
    value: 1000,
    vout: 2
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
    prefix: '83c0cc08',
    txid: '83c0cc0895e40a9837860b3e06064f12da763b4c5b6e9f8ec125f657066f7771',
    value: 434,
    vout: 0
  },
  {
    prefix: 'cb145a00',
    txid: 'cb145a00c35b6e40eab4594f79fea86bc1a9c8876e5cacae89fb85652d23049a',
    value: 410,
    vout: 1
  }
]

/** Sparrow privacy (STONEWALL) auto-selection — 8 inputs, 2 sets. */
const SPARROW_STONEWALL_SELECTION: SparrowUtxoRef[] = [
  {
    prefix: '85bb749b',
    txid: '85bb749bd821291a0a2509c8b6fb95f4376a1c0d8f6117f45c5fd6d7603020e8',
    value: 2743,
    vout: 0
  },
  {
    prefix: '405267c3',
    txid: '405267c3c661930e903732a05d4388ca46cb960ef796c5e5d2b85865edbf15f6',
    value: 691,
    vout: 1
  },
  {
    prefix: '354c99e4',
    txid: '354c99e4f7839b9fa0118564968ce4948f378d12cfc342419f8eb07481f3ef74',
    value: 186_443,
    vout: 1
  },
  {
    prefix: '5ba6a157',
    txid: '5ba6a157ace46f4683c21c3323e98f4915ebf84bfdc50c84e4249b13e941c5f4',
    value: 692,
    vout: 0
  },
  {
    prefix: 'cb145a00',
    txid: 'cb145a00c35b6e40eab4594f79fea86bc1a9c8876e5cacae89fb85652d23049a',
    value: 410,
    vout: 1
  },
  {
    prefix: '83c0cc08',
    txid: '83c0cc0895e40a9837860b3e06064f12da763b4c5b6e9f8ec125f657066f7771',
    value: 434,
    vout: 0
  },
  {
    prefix: '5ba6a157',
    txid: '5ba6a157ace46f4683c21c3323e98f4915ebf84bfdc50c84e4249b13e941c5f4',
    value: 1345,
    vout: 1
  },
  {
    prefix: '98981d2d',
    txid: '98981d2da372b6a98002ffba6167c5d2e551ca19cf33b99f890b793a5c19d8cc',
    value: 143_565,
    vout: 0
  }
]

/** Sparrow UI showed 678 sats; selector computes 676 at 1 sat/vB (2-sat rounding). */
const SPARROW_STONEWALL_FEE = 676

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
