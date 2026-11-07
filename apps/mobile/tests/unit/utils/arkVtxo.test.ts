import { PRIVACY_MASK } from '@/constants/privacy'
import type { ArkBalance, ArkVtxo } from '@/types/models/Ark'
import {
  arkVtxosToBubbleData,
  buildArkVtxoSections,
  filterCurrentArkVtxos,
  filterSelectableVtxoIds,
  getArkNextExpiryHeight,
  isArkVtxoBusy,
  isArkVtxoNeedingRefresh,
  moveBusyArkVtxosOutOfSpendable,
  sumArkVtxoSats
} from '@/utils/arkVtxo'
import { formatNumber } from '@/utils/format'

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

describe('getArkNextExpiryHeight', () => {
  it('returns the minimum expiry height among spendable vtxos', () => {
    const vtxos = [
      buildVtxo({ expiryHeight: 300, id: 'a' }),
      buildVtxo({ expiryHeight: 150, id: 'b' }),
      buildVtxo({ expiryHeight: 200, id: 'c' })
    ]
    expect(getArkNextExpiryHeight(vtxos)).toBe(150)
  })

  it('ignores non-spendable vtxos', () => {
    const vtxos = [
      buildVtxo({ expiryHeight: 50, id: 'a', spendable: false }),
      buildVtxo({ expiryHeight: 200, id: 'b' })
    ]
    expect(getArkNextExpiryHeight(vtxos)).toBe(200)
  })

  it('returns null when there are no spendable vtxos', () => {
    expect(getArkNextExpiryHeight([])).toBeNull()
    expect(
      getArkNextExpiryHeight([buildVtxo({ id: 'a', spendable: false })])
    ).toBeNull()
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

describe('arkVtxosToBubbleData', () => {
  it('maps vtxos to bubble data, marking locked and selected', () => {
    const vtxos = [
      buildVtxo({ amountSats: 1000, id: 'a', spendable: true }),
      buildVtxo({ amountSats: 500, id: 'b', spendable: false })
    ]

    expect(arkVtxosToBubbleData(vtxos, ['a'], false)).toStrictEqual([
      {
        id: 'a',
        label: formatNumber(1000),
        locked: false,
        selected: true,
        value: 1000
      },
      {
        id: 'b',
        label: formatNumber(500),
        locked: true,
        selected: false,
        value: 500
      }
    ])
  })

  it('masks labels in privacy mode', () => {
    const data = arkVtxosToBubbleData(
      [buildVtxo({ amountSats: 1000, id: 'a' })],
      [],
      true
    )
    expect(data[0].label).toBe(PRIVACY_MASK)
    expect(data[0].value).toBe(1000)
  })
})

describe('isArkVtxoBusy', () => {
  const busy = { exiting: new Set(['e']), inRound: new Set(['r']) }

  it('flags vtxos that are exiting or queued for a round', () => {
    expect(isArkVtxoBusy('e', busy)).toBe(true)
    expect(isArkVtxoBusy('r', busy)).toBe(true)
    expect(isArkVtxoBusy('free', busy)).toBe(false)
  })
})

describe('isArkVtxoNeedingRefresh', () => {
  const vtxo = buildVtxo({ exitDepth: 3, expiryHeight: 100 })

  it('flags vtxos that reached their expiry height', () => {
    expect(isArkVtxoNeedingRefresh(vtxo, { tipHeight: 100 })).toBe(true)
    expect(isArkVtxoNeedingRefresh(vtxo, { tipHeight: 99 })).toBe(false)
  })

  it('flags vtxos that reached the max exit depth', () => {
    expect(isArkVtxoNeedingRefresh(vtxo, { maxExitDepth: 3 })).toBe(true)
    expect(isArkVtxoNeedingRefresh(vtxo, { maxExitDepth: 4 })).toBe(false)
  })

  it('flags nothing when the tip and server info are unknown', () => {
    expect(isArkVtxoNeedingRefresh(vtxo, {})).toBe(false)
  })
})

describe('moveBusyArkVtxosOutOfSpendable', () => {
  const NO_THRESHOLDS = {}
  const balance: ArkBalance = {
    claimableLightningReceiveSats: 0,
    needsRefreshSats: 0,
    pendingBoardSats: 0,
    pendingExitSats: 0,
    pendingInRoundSats: 0,
    pendingLightningSendSats: 0,
    spendableSats: 6000
  }
  const vtxos = [
    buildVtxo({ amountSats: 1000, id: 'free' }),
    buildVtxo({ amountSats: 2000, id: 'exiting' }),
    buildVtxo({ amountSats: 3000, id: 'queued' })
  ]

  it('moves exiting sats to pending exit and queued sats to pending round', () => {
    const result = moveBusyArkVtxosOutOfSpendable(
      balance,
      vtxos,
      { exiting: new Set(['exiting']), inRound: new Set(['queued']) },
      NO_THRESHOLDS
    )
    expect(result).toMatchObject({
      pendingExitSats: 2000,
      pendingInRoundSats: 3000,
      spendableSats: 1000
    })
  })

  it('counts a vtxo that is both exiting and queued only once', () => {
    const result = moveBusyArkVtxosOutOfSpendable(
      balance,
      vtxos,
      { exiting: new Set(['exiting']), inRound: new Set(['exiting']) },
      NO_THRESHOLDS
    )
    expect(result).toMatchObject({
      pendingExitSats: 2000,
      pendingInRoundSats: 0,
      spendableSats: 4000
    })
  })

  it('takes a busy vtxo that needs a refresh out of needs-refresh', () => {
    const result = moveBusyArkVtxosOutOfSpendable(
      { ...balance, needsRefreshSats: 5000, spendableSats: 10_000 },
      [
        buildVtxo({ amountSats: 10_000, exitDepth: 1, id: 'free' }),
        buildVtxo({ amountSats: 5000, exitDepth: 10, id: 'deep' })
      ],
      { exiting: new Set(), inRound: new Set(['deep']) },
      { maxExitDepth: 10 }
    )
    expect(result).toMatchObject({
      needsRefreshSats: 0,
      pendingInRoundSats: 5000,
      spendableSats: 10_000
    })
  })

  it('takes from needs-refresh once spendable runs out, keeping the total', () => {
    const result = moveBusyArkVtxosOutOfSpendable(
      { ...balance, needsRefreshSats: 2000, spendableSats: 1000 },
      [buildVtxo({ amountSats: 2500, id: 'exiting' })],
      { exiting: new Set(['exiting']), inRound: new Set() },
      NO_THRESHOLDS
    )
    expect(result).toMatchObject({
      needsRefreshSats: 500,
      pendingExitSats: 2500,
      spendableSats: 0
    })
  })

  it('takes from spendable once needs-refresh runs out, keeping the total', () => {
    const result = moveBusyArkVtxosOutOfSpendable(
      balance,
      [buildVtxo({ amountSats: 2000, expiryHeight: 100, id: 'exiting' })],
      { exiting: new Set(['exiting']), inRound: new Set() },
      { tipHeight: 100 }
    )
    expect(result).toMatchObject({
      needsRefreshSats: 0,
      pendingExitSats: 2000,
      spendableSats: 4000
    })
  })

  it('ignores busy ids that bark no longer lists as spendable', () => {
    const result = moveBusyArkVtxosOutOfSpendable(
      balance,
      vtxos,
      { exiting: new Set(['gone']), inRound: new Set() },
      NO_THRESHOLDS
    )
    expect(result).toMatchObject({ pendingExitSats: 0, spendableSats: 6000 })
  })
})
