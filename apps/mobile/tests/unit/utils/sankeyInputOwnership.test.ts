import { type Account } from '@/types/models/Account'
import {
  analyzePossiblePayjoin,
  buildOwnedOutpoints,
  isOwnedOutpoint
} from '@/utils/sankeyInputOwnership'

function makeAddress(
  address: string,
  keychain: 'internal' | 'external' = 'external'
): Account['addresses'][number] {
  return {
    address,
    keychain,
    label: '',
    summary: {
      balance: 0,
      satsInMempool: 0,
      transactions: 0,
      utxos: 0
    },
    transactions: [],
    utxos: []
  }
}

describe('buildOwnedOutpoints', () => {
  it('includes current utxos and outputs to own addresses', () => {
    const owned = buildOwnedOutpoints({
      addresses: [makeAddress('tb1qown')],
      transactions: [
        {
          id: 'fundingtx',
          vout: [
            { address: 'tb1qown', value: 50_000 },
            { address: 'tb1qother', value: 10_000 }
          ]
        }
      ],
      utxos: [{ txid: 'utxotx', vout: 1 }]
    })

    expect(owned.has('fundingtx:0')).toBe(true)
    expect(owned.has('fundingtx:1')).toBe(false)
    expect(owned.has('utxotx:1')).toBe(true)
  })
})

describe('isOwnedOutpoint', () => {
  it('returns undefined without an ownership set', () => {
    expect(isOwnedOutpoint(undefined, 'a', 0)).toBeUndefined()
  })

  it('returns boolean when the set is present', () => {
    const owned = new Set(['a:0'])
    expect(isOwnedOutpoint(owned, 'a', 0)).toBe(true)
    expect(isOwnedOutpoint(owned, 'a', 1)).toBe(false)
  })
})

describe('analyzePossiblePayjoin', () => {
  const owned = new Set(['ours:0'])

  it('flags mixed ownership as a possible payjoin', () => {
    const insight = analyzePossiblePayjoin(
      [
        { previousOutput: { txid: 'ours', vout: 0 }, value: 20_000 },
        { previousOutput: { txid: 'theirs', vout: 1 }, value: 80_000 }
      ],
      owned
    )

    expect(insight.possiblePayjoin).toBe(true)
    expect(insight.contributedSats).toBe(20_000)
    expect(insight.counterpartyInputSats).toBe(80_000)
  })

  it('does not flag a normal single-wallet send', () => {
    const insight = analyzePossiblePayjoin(
      [
        { previousOutput: { txid: 'ours', vout: 0 }, value: 50_000 },
        { previousOutput: { txid: 'ours', vout: 0 }, value: 10_000 }
      ],
      new Set(['ours:0'])
    )

    expect(insight.possiblePayjoin).toBe(false)
    expect(insight.hasForeignInput).toBe(false)
  })
})
