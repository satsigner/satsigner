import type { ArkVtxo } from '@/types/models/Ark'
import {
  buildArkVtxoSections,
  filterCurrentArkVtxos,
  filterSelectableVtxoIds,
  sumArkVtxoSats
} from '@/utils/arkVtxo'

function buildVtxo(overrides: Partial<ArkVtxo> = {}): ArkVtxo {
  return {
    amountSats: 1000,
    exitDepth: 1,
    expiryHeight: 100,
    id: 'vtxo-1',
    kind: 'arkoor',
    spendable: true,
    state: 'Spendable',
    ...overrides
  }
}

describe('buildArkVtxoSections', () => {
  it('groups spendable first, then locked, each with a header', () => {
    const vtxos = [
      buildVtxo({ id: 's1', spendable: true }),
      buildVtxo({ id: 'l1', spendable: false }),
      buildVtxo({ id: 's2', spendable: true })
    ]
    const items = buildArkVtxoSections(vtxos)
    expect(items.map((item) => item.key)).toStrictEqual([
      'header-spendable',
      's1',
      's2',
      'header-locked',
      'l1'
    ])
  })

  it('omits a section when it has no VTXOs', () => {
    const vtxos = [
      buildVtxo({ id: 's1', spendable: true }),
      buildVtxo({ id: 's2', spendable: true })
    ]
    const items = buildArkVtxoSections(vtxos)
    expect(items.some((item) => item.key === 'header-locked')).toBe(false)
    expect(items[0]).toMatchObject({ count: 2, group: 'spendable' })
  })

  it('returns an empty list when there are no VTXOs', () => {
    expect(buildArkVtxoSections([])).toStrictEqual([])
  })
})

describe('filterSelectableVtxoIds', () => {
  it('drops ids of vtxos that became locked or disappeared', () => {
    const vtxos = [
      buildVtxo({ id: 's1', spendable: true }),
      buildVtxo({ id: 'l1', spendable: false })
    ]
    expect(filterSelectableVtxoIds(vtxos, ['s1', 'l1', 'gone'])).toStrictEqual([
      's1'
    ])
  })

  it('keeps ids again once a vtxo returns to spendable', () => {
    const vtxos = [buildVtxo({ id: 'v1', spendable: true })]
    expect(filterSelectableVtxoIds(vtxos, ['v1'])).toStrictEqual(['v1'])
  })
})

describe('filterCurrentArkVtxos', () => {
  it('drops spent and exited vtxos, keeps spendable and locked', () => {
    const vtxos = [
      buildVtxo({ id: 'a', state: 'Spendable' }),
      buildVtxo({ id: 'b', spendable: false, state: 'Locked' }),
      buildVtxo({ id: 'c', spendable: false, state: 'Spent' }),
      buildVtxo({ id: 'd', spendable: false, state: 'Exited' })
    ]
    expect(filterCurrentArkVtxos(vtxos).map((vtxo) => vtxo.id)).toStrictEqual([
      'a',
      'b'
    ])
  })

  it('matches states case-insensitively', () => {
    const vtxos = [
      buildVtxo({ id: 'a', spendable: false, state: 'spent' }),
      buildVtxo({ id: 'b', spendable: false, state: 'exited' }),
      buildVtxo({ id: 'c', state: 'spendable' })
    ]
    expect(filterCurrentArkVtxos(vtxos).map((vtxo) => vtxo.id)).toStrictEqual([
      'c'
    ])
  })
})

describe('sumArkVtxoSats', () => {
  it('sums only the selected vtxos', () => {
    const vtxos = [
      buildVtxo({ amountSats: 100, id: 'a' }),
      buildVtxo({ amountSats: 250, id: 'b' }),
      buildVtxo({ amountSats: 999, id: 'c' })
    ]
    expect(sumArkVtxoSats(vtxos, new Set(['a', 'b']))).toBe(350)
  })
})
