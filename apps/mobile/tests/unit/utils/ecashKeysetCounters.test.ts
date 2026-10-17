import {
  buildCounterInit,
  withKeysetCounter
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

describe('withKeysetCounter', () => {
  it('replaces the keyset counter and keeps the others', () => {
    expect(
      withKeysetCounter(
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
})
