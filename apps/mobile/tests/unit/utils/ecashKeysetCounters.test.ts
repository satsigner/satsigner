import {
  buildCounterInit,
  withAdvancedKeysetCounter
} from '@/utils/ecashKeysetCounters'

describe('buildCounterInit', () => {
  it('maps each keyset to its counter', () => {
    expect(
      buildCounterInit([
        { counter: 3, keysetId: 'a' },
        { counter: 7, keysetId: 'b' }
      ])
    ).toStrictEqual({ a: 3, b: 7 })
  })
})

describe('withAdvancedKeysetCounter', () => {
  it('advances the keyset counter and keeps the others', () => {
    expect(
      withAdvancedKeysetCounter(
        [
          { counter: 3, keysetId: 'a' },
          { counter: 7, keysetId: 'b' }
        ],
        'a',
        5
      )
    ).toStrictEqual([
      { counter: 7, keysetId: 'b' },
      { counter: 5, keysetId: 'a' }
    ])
  })

  it('adds a counter for a new keyset', () => {
    expect(withAdvancedKeysetCounter([], 'a', 4)).toStrictEqual([
      { counter: 4, keysetId: 'a' }
    ])
  })

  it('never moves a counter back', () => {
    expect(
      withAdvancedKeysetCounter([{ counter: 9, keysetId: 'a' }], 'a', 2)
    ).toStrictEqual([{ counter: 9, keysetId: 'a' }])
  })
})
