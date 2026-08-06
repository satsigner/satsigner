import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import {
  filterPayjoinContributeUtxos,
  isConfirmedUtxo,
  walletCanContributeToPayjoin
} from '@/utils/payjoinUtxos'

function utxo(overrides: Partial<Utxo> & Pick<Utxo, 'txid' | 'value'>): Utxo {
  return {
    keychain: 'external',
    vout: 0,
    ...overrides
  }
}

function tx(
  overrides: Partial<Transaction> & Pick<Transaction, 'id' | 'blockHeight'>
): Transaction {
  return {
    lockTimeEnabled: false,
    prices: {},
    received: 0,
    sent: 0,
    type: 'receive',
    vin: [],
    vout: [],
    ...overrides
  }
}

describe('isConfirmedUtxo', () => {
  it('requires a matching tx with blockHeight > 0', () => {
    const coin = utxo({ txid: 'aa', value: 20_000 })
    expect(isConfirmedUtxo(coin, [tx({ blockHeight: 100, id: 'aa' })])).toBe(
      true
    )
    expect(isConfirmedUtxo(coin, [tx({ blockHeight: 0, id: 'aa' })])).toBe(
      false
    )
    expect(isConfirmedUtxo(coin, [tx({ blockHeight: 100, id: 'bb' })])).toBe(
      false
    )
  })
})

describe('filterPayjoinContributeUtxos', () => {
  it('keeps confirmed coins above the min contribute floor', () => {
    const utxos = [
      utxo({ txid: 'dust', value: 5_000 }),
      utxo({ txid: 'unconfirmed', value: 50_000 }),
      utxo({ txid: 'ok', value: 50_000 })
    ]
    const transactions = [
      tx({ blockHeight: 10, id: 'dust' }),
      tx({ blockHeight: 0, id: 'unconfirmed' }),
      tx({ blockHeight: 10, id: 'ok' })
    ]

    expect(filterPayjoinContributeUtxos(utxos, transactions)).toStrictEqual([
      utxos[2]
    ])
  })
})

describe('walletCanContributeToPayjoin', () => {
  it('is false when only unconfirmed or dust coins exist', () => {
    expect(
      walletCanContributeToPayjoin(
        [utxo({ txid: 'a', value: 50_000 })],
        [tx({ blockHeight: 0, id: 'a' })]
      )
    ).toBe(false)
    expect(
      walletCanContributeToPayjoin(
        [utxo({ txid: 'a', value: 5_000 })],
        [tx({ blockHeight: 10, id: 'a' })]
      )
    ).toBe(false)
  })

  it('is true when a confirmed coin clears the floor', () => {
    expect(
      walletCanContributeToPayjoin(
        [utxo({ txid: 'a', value: 5_001 })],
        [tx({ blockHeight: 10, id: 'a' })]
      )
    ).toBe(true)
  })
})
