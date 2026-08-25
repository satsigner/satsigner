import type { ArkBalance } from '@/types/models/Ark'
import { getArkPendingSats, getArkTotalSats } from '@/utils/ark'

function buildBalance(overrides: Partial<ArkBalance> = {}): ArkBalance {
  return {
    claimableLightningReceiveSats: 0,
    pendingBoardSats: 0,
    pendingExitSats: 0,
    pendingInRoundSats: 0,
    pendingLightningSendSats: 0,
    spendableSats: 0,
    ...overrides
  }
}

describe('getArkPendingSats', () => {
  it('sums round, board and claimable lightning receive sats', () => {
    const balance = buildBalance({
      claimableLightningReceiveSats: 30,
      pendingBoardSats: 20,
      pendingInRoundSats: 100
    })
    expect(getArkPendingSats(balance)).toBe(150)
  })

  it('ignores outgoing pending exit and lightning send sats', () => {
    const balance = buildBalance({
      pendingExitSats: 500,
      pendingLightningSendSats: 700
    })
    expect(getArkPendingSats(balance)).toBe(0)
  })
})

describe('getArkTotalSats', () => {
  it('adds spendable and pending sats', () => {
    const balance = buildBalance({
      pendingInRoundSats: 100,
      spendableSats: 250
    })
    expect(getArkTotalSats(balance)).toBe(350)
  })

  it('equals pending when nothing is spendable yet (refresh round)', () => {
    const balance = buildBalance({ pendingInRoundSats: 1000 })
    expect(getArkTotalSats(balance)).toBe(1000)
  })
})
