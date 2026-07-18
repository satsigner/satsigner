export type ExplorerExampleTransaction = {
  description: string
  inputs: number
  label: string
  outputs: number
  txid: string
}

export type ExplorerExampleAddress = {
  address: string
  description: string
  label: string
}

export type ExplorerExampleBlock = {
  description: string
  height: number
  label: string
}

export const EXPLORER_EXAMPLE_TRANSACTIONS: ExplorerExampleTransaction[] = [
  // Edge cases — coinbase / activation / script types
  {
    description: 'Genesis coinbase — first Bitcoin ever mined (Jan 3, 2009)',
    inputs: 1,
    label: 'Genesis',
    outputs: 1,
    txid: '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b'
  },
  {
    description: 'Block 1 coinbase — second block ever mined',
    inputs: 1,
    label: 'Block 1',
    outputs: 1,
    txid: '0e3e2357e806b6cdb1f70b54c3a3a17b6714ee1f0e68bebb44a74b1efd512098'
  },
  {
    description:
      'SegWit activation coinbase — includes OP_RETURN witness commitment (Aug 24, 2017)',
    inputs: 1,
    label: 'SegWit coinbase',
    outputs: 2,
    txid: 'da917699942e4a96272401b534381a75512eeebe8403084500bd637bd47168b3'
  },
  {
    description: 'Early native SegWit spend (P2WPKH). Simple payment shape',
    inputs: 1,
    label: 'SegWit',
    outputs: 1,
    txid: 'dfcec48bb8491856c353306ab5febeb7e99e4d783eedf3de98f3ee0812b92bad'
  },
  {
    description:
      'First Taproot output in the activation block — Taproot + OP_RETURN (Nov 14, 2021)',
    inputs: 1,
    label: 'Taproot birth',
    outputs: 2,
    txid: '777c998695de4b7ecec54c058c73b2cab71184cf1655840935cd9388923dc288'
  },
  {
    description:
      'Taproot spend — modern multi-input payment with Taproot inputs',
    inputs: 3,
    label: 'Taproot spend',
    outputs: 2,
    txid: '1c293306cb10e8fd99257e5849cd8ed5b32cdf8e70429227c2bc886618d137d9'
  },
  {
    description: 'OP_RETURN data carrier — includes a null-data output',
    inputs: 1,
    label: 'OP_RETURN',
    outputs: 3,
    txid: '1d8149eb8d8475b98113b5011cf70e0b7a4dccff71286d28b8b4b641f94f1e46'
  },
  {
    description:
      'Burn to the Bitcoin Eater address — coins sent to a provably unspendable sink',
    inputs: 1,
    label: 'Burn',
    outputs: 2,
    txid: 'aec077d1d89bfade96509d6b5837e27b93c22afa00e92f2a8b6f5a423efaf2d3'
  },

  // Standard / few I/O
  {
    description:
      'First person-to-person payment — Satoshi → Hal Finney, 10 BTC (Jan 12, 2009)',
    inputs: 1,
    label: 'First Tx',
    outputs: 2,
    txid: 'f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16'
  },
  {
    description:
      'Typical small payment — inputs consolidating into payment + change',
    inputs: 3,
    label: 'Average',
    outputs: 2,
    txid: 'bcf84712500459da1670546601ef7373946fbca624f2e9957a53f5205102a224'
  },
  {
    description: 'Few inputs consolidated to one — 180K BTC (Mar 2014)',
    inputs: 5,
    label: 'Few inputs',
    outputs: 1,
    txid: '4ee89f7cf824a85ad5f11d52604ffdebe9f01302bcea8ddec0af450f9185ddf1'
  },
  {
    description:
      'Single SegWit input splitting to payment + change — common wallet send',
    inputs: 1,
    label: 'Standard',
    outputs: 2,
    txid: '1ee11c8a24c9244f14c4d5a9c3670c13664f4ae8f7738c31b4f21221a5bdfbd1'
  },

  // Moderate I/O
  {
    description: 'Moderate fan-in — 500,000 BTC moved (Nov 2011)',
    inputs: 11,
    label: 'Moderate inputs',
    outputs: 2,
    txid: '29a3efd3ef04f9153d47a990bd7b048a4b2d213daaa5fb8ed670fb85f13bdbcf'
  },
  {
    description: 'Mid-size fan-out — exchange-style batch payout',
    inputs: 1,
    label: 'Moderate outputs',
    outputs: 10,
    txid: '4ef86047959d9125746266c4a87d84e217efbc6ce799639e5c27c42cd7521e08'
  },
  {
    description: 'Larger fan-in — ~195K BTC whale move (Nov 2013)',
    inputs: 47,
    label: 'Many inputs',
    outputs: 2,
    txid: '1c12443203a48f42cdf7b1acee5b4b1c1fedc144cb909a3bf5edbffafb0cd204'
  },

  // Lots of inputs / outputs
  {
    description:
      'First known BTC→USD sale — Martti "Sirius" Malmi, 5,050 BTC for $5.02 (2009)',
    inputs: 74,
    label: 'Lots of inputs',
    outputs: 1,
    txid: '7dff938918f07619abd38e4510890396b1cef4fbeca154fb7aafba8843295ea2'
  },
  {
    description: 'Pizza Day — 10,000 BTC for two pizzas (May 22, 2010)',
    inputs: 131,
    label: 'Pizza Day',
    outputs: 1,
    txid: 'a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d'
  },
  {
    description: 'Heavy consolidation — 130K BTC transfer (Jan 2019)',
    inputs: 158,
    label: 'Heavy consolidation',
    outputs: 1,
    txid: 'f6c98463b7b6bc9c866e66a1341dac29e524071c553282f583e30f3009afb901'
  },
  {
    description:
      'Large fan-in consolidation — ~95K BTC / ~$1B at the time (Sep 2019)',
    inputs: 92,
    label: '$1B Move',
    outputs: 1,
    txid: '4410c8d14ff9f87ceeed1d65cb58e7c7b2422b2d7529afc675208ce2ce09ed7d'
  },
  {
    description: 'Extreme fan-out — stress-tests chart layout',
    inputs: 1,
    label: 'Lots of outputs',
    outputs: 948,
    txid: '54e48e5f5c656b26c3bca14a8c95aa583d07ebe84dde3b7dd4a78f4e4186e713'
  }
]

export const EXPLORER_EXAMPLE_BLOCKS: ExplorerExampleBlock[] = [
  {
    description:
      'Genesis block — Times headline embedded in the coinbase (Jan 3, 2009)',
    height: 0,
    label: 'Genesis'
  },
  {
    description: 'Block 1 — first block after genesis (mined 6 days later)',
    height: 1,
    label: 'Block 1'
  },
  {
    description:
      'First peer-to-peer payment — Satoshi → Hal Finney, 10 BTC (Jan 12, 2009)',
    height: 170,
    label: 'First Tx'
  },
  {
    description: 'Pizza Day — 10,000 BTC paid for two pizzas (May 22, 2010)',
    height: 57043,
    label: 'Pizza Day'
  },
  {
    description: 'Value overflow incident — 184 billion BTC bug (Aug 15, 2010)',
    height: 74638,
    label: 'Overflow Bug'
  },
  {
    description: '100,000th block — early network maturity milestone',
    height: 100000,
    label: '100K'
  },
  {
    description: 'First halving — block subsidy 50 → 25 BTC (Nov 28, 2012)',
    height: 210000,
    label: '1st Halving'
  },
  {
    description: 'Second halving — block subsidy 25 → 12.5 BTC (Jul 9, 2016)',
    height: 420000,
    label: '2nd Halving'
  },
  {
    description:
      'Bitcoin Cash hard fork — last shared BTC/BCH block (Aug 1, 2017)',
    height: 478558,
    label: 'BCH Fork'
  },
  {
    description: 'SegWit activation — BIP141 soft fork (Aug 24, 2017)',
    height: 481824,
    label: 'SegWit'
  },
  {
    description: '500,000th block — mid-history milestone',
    height: 500000,
    label: '500K'
  },
  {
    description: 'Third halving — block subsidy 12.5 → 6.25 BTC (May 11, 2020)',
    height: 630000,
    label: '3rd Halving'
  },
  {
    description: 'Taproot activation — BIP341 soft fork (Nov 14, 2021)',
    height: 709632,
    label: 'Taproot'
  },
  {
    description:
      'First Ordinals inscription — inscription #0 by Casey Rodarmor (Dec 14, 2022)',
    height: 767430,
    label: 'Ordinals'
  },
  {
    description:
      'Fourth halving — block subsidy 6.25 → 3.125 BTC (Apr 20, 2024)',
    height: 840000,
    label: '4th Halving'
  }
]

export const EXPLORER_EXAMPLE_ADDRESSES: ExplorerExampleAddress[] = [
  {
    address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    description:
      'Genesis block coinbase — first Bitcoin address, mined by Satoshi Nakamoto (Jan 3, 2009)',
    label: 'Genesis'
  },
  {
    address: '12c6DSiU4Rq3P4ZxziKxzrL5LmMBrzjrJX',
    description: 'Block 1 coinbase address — second block ever mined',
    label: 'Block 1'
  },
  {
    address: '17SkEw2md5avVNyYgj6RiXuQKNwkXaxFyQ',
    description:
      'Received 10,000 BTC for two pizzas — first real-world Bitcoin purchase (May 22, 2010)',
    label: 'Pizza Day'
  },
  {
    address: '1FeexV6bAHb8ybZjqQMjJrcCrHGW9sb6uF',
    description:
      'Large early dormant wallet — tens of thousands of BTC untouched for years',
    label: 'Dormant Whale'
  },
  {
    address: '1HB5XMLmzFVj8ALj6mfBsbifRoD4miY36v',
    description: 'WikiLeaks donation address — accepted Bitcoin from 2011',
    label: 'WikiLeaks'
  },
  {
    address: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
    description:
      'Associated with Silk Road seized funds moved by US authorities',
    label: 'Silk Road'
  },
  {
    address: '34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo',
    description: 'Long-running Binance cold storage address',
    label: 'Binance Cold'
  },
  {
    address: '3D2oetdNuZUqQHPJmcMDDHYoqkyNVsFk9r',
    description: 'Bitfinex cold wallet — major exchange reserve address',
    label: 'Bitfinex Cold'
  },
  {
    address: 'bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv24sq90ecnvqqjwvw97',
    description: 'Large native SegWit cold storage often linked to Bitfinex',
    label: 'Bitfinex SegWit'
  },
  {
    address: '1BitcoinEaterAddressDontSendf59kuE',
    description:
      'Provably unspendable burn address — coins sent here are destroyed',
    label: 'Bitcoin Eater'
  }
]

const EXAMPLE_TX_BY_ID = new Map(
  EXPLORER_EXAMPLE_TRANSACTIONS.map((ex) => [ex.txid.toLowerCase(), ex])
)

const EXAMPLE_BLOCK_BY_HEIGHT = new Map(
  EXPLORER_EXAMPLE_BLOCKS.map((ex) => [ex.height, ex])
)

const EXAMPLE_ADDRESS_BY_VALUE = new Map(
  EXPLORER_EXAMPLE_ADDRESSES.flatMap((ex) => {
    const entries: [string, ExplorerExampleAddress][] = [[ex.address, ex]]
    const lower = ex.address.toLowerCase()
    // Bech32 is case-insensitive; keep a lowercase key for lookups.
    if (lower.startsWith('bc1') || lower.startsWith('tb1')) {
      entries.push([lower, ex])
    }
    return entries
  })
)

export function getExplorerExampleTransaction(
  txid: string | null | undefined
): ExplorerExampleTransaction | undefined {
  if (!txid) {
    return undefined
  }
  return EXAMPLE_TX_BY_ID.get(txid.trim().toLowerCase())
}

export function getExplorerExampleAddress(
  address: string | null | undefined
): ExplorerExampleAddress | undefined {
  if (!address) {
    return undefined
  }
  const trimmed = address.trim()
  return (
    EXAMPLE_ADDRESS_BY_VALUE.get(trimmed) ??
    EXAMPLE_ADDRESS_BY_VALUE.get(trimmed.toLowerCase())
  )
}

export function getExplorerExampleBlock(
  height: number | string | null | undefined
): ExplorerExampleBlock | undefined {
  if (height === null || height === undefined || height === '') {
    return undefined
  }
  const n = typeof height === 'number' ? height : Number(height)
  if (!Number.isInteger(n) || n < 0) {
    return undefined
  }
  return EXAMPLE_BLOCK_BY_HEIGHT.get(n)
}
