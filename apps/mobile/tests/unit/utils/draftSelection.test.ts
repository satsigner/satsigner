import { getDraftIoCounts, resolveDraftAlgorithm } from '@/utils/draftSelection'

describe('resolveDraftAlgorithm', () => {
  it('returns the persisted algorithm when present', () => {
    expect(
      resolveDraftAlgorithm({
        outputs: [],
        selectedAutoSelectUtxos: 'efficiency'
      })
    ).toBe('efficiency')
  })

  it('infers privacy from stonewall-managed outputs on legacy drafts', () => {
    expect(
      resolveDraftAlgorithm({
        outputs: [
          {
            kind: 'fakeMix'
          }
        ]
      })
    ).toBe('privacy')

    expect(
      resolveDraftAlgorithm({
        outputs: [
          {
            kind: 'change'
          }
        ]
      })
    ).toBe('privacy')
  })

  it('defaults to user when nothing was applied', () => {
    expect(resolveDraftAlgorithm(undefined)).toBe('user')
    expect(resolveDraftAlgorithm({ outputs: [] })).toBe('user')
    expect(
      resolveDraftAlgorithm({
        outputs: [{ kind: undefined }]
      })
    ).toBe('user')
  })
})

describe('getDraftIoCounts', () => {
  it('returns zeros for a missing draft', () => {
    expect(getDraftIoCounts(undefined)).toStrictEqual({
      inputCount: 0,
      outputCount: 0
    })
  })

  it('counts store inputs and outputs for a simple draft', () => {
    expect(
      getDraftIoCounts({
        fee: 200,
        inputs: {
          'a:0': { value: 10_000 },
          'b:1': { value: 5_000 }
        },
        outputs: [{ amount: 14_800, kind: undefined }]
      })
    ).toStrictEqual({ inputCount: 2, outputCount: 1 })
  })

  it('includes impending change when remaining balance is positive', () => {
    expect(
      getDraftIoCounts({
        fee: 500,
        inputs: {
          'a:0': { value: 20_000 }
        },
        outputs: [{ amount: 10_000, kind: undefined }],
        selectedAutoSelectUtxos: 'user'
      })
    ).toStrictEqual({ inputCount: 1, outputCount: 2 })
  })

  it('includes stonewall preview outputs for privacy drafts', () => {
    expect(
      getDraftIoCounts({
        fee: 1_000,
        inputs: {
          'a:0': { value: 50_000 },
          'b:0': { value: 40_000 },
          'c:0': { value: 30_000 },
          'd:0': { value: 20_000 }
        },
        outputs: [{ amount: 25_000, kind: undefined }],
        selectedAutoSelectUtxos: 'privacy',
        stonewallPreview: {
          changeValues: [30_000, 20_000],
          fakeMixValues: [24_000]
        }
      })
    ).toStrictEqual({ inputCount: 4, outputCount: 4 })
  })

  it('does not double-count materialized stonewall outputs', () => {
    expect(
      getDraftIoCounts({
        fee: 1_000,
        inputs: {
          'a:0': { value: 50_000 }
        },
        outputs: [
          { amount: 25_000, kind: undefined },
          { amount: 24_000, kind: 'fakeMix' },
          { amount: 0, kind: 'change' }
        ],
        selectedAutoSelectUtxos: 'privacy',
        stonewallPreview: {
          changeValues: [30_000],
          fakeMixValues: [24_000]
        }
      })
    ).toStrictEqual({ inputCount: 1, outputCount: 3 })
  })
})
