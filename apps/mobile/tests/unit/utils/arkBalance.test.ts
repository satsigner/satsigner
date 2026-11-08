import type { ArkBalance, ArkOnchainBalance } from '@/types/models/Ark'
import { getArkBalanceBreakdown } from '@/utils/ark'

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

function buildOnchainBalance(
  confirmedSats: number,
  pendingSats: number
): ArkOnchainBalance {
  return {
    confirmedSats,
    pendingSats,
    totalSats: confirmedSats + pendingSats
  }
}

describe('getArkBalanceBreakdown', () => {
  it('returns an empty breakdown without balances', () => {
    expect(getArkBalanceBreakdown(undefined, undefined)).toStrictEqual({
      rows: [],
      showBreakdown: false,
      totalSats: 0
    })
  })

  it('hides the breakdown when only off-chain sats exist', () => {
    const breakdown = getArkBalanceBreakdown(
      buildBalance({ spendableSats: 5000 }),
      buildOnchainBalance(0, 0)
    )
    expect(breakdown.totalSats).toBe(5000)
    expect(breakdown.showBreakdown).toBe(false)
    expect(breakdown.rows).toStrictEqual([
      { amountSats: 5000, key: 'offchain' }
    ])
  })

  it('separates on-chain from off-chain sats', () => {
    const breakdown = getArkBalanceBreakdown(
      buildBalance({ spendableSats: 5000 }),
      buildOnchainBalance(20_000, 3000)
    )
    expect(breakdown.totalSats).toBe(28_000)
    expect(breakdown.showBreakdown).toBe(true)
    expect(breakdown.rows.map((row) => row.key)).toStrictEqual([
      'offchain',
      'onchain',
      'onchainPending'
    ])
  })

  it('counts sats that need a refresh, which bark excludes from spendable', () => {
    const breakdown = getArkBalanceBreakdown(
      buildBalance({ needsRefreshSats: 700, spendableSats: 300 }),
      undefined
    )
    expect(breakdown.totalSats).toBe(1000)
  })

  it('sums every pending bucket into the total', () => {
    const breakdown = getArkBalanceBreakdown(
      buildBalance({
        claimableLightningReceiveSats: 1,
        pendingArkoorSendSats: 2,
        pendingBoardSats: 4,
        pendingExitSats: 8,
        pendingInRoundSats: 16,
        pendingLightningSendSats: 32,
        pendingOffboardSats: 64
      }),
      undefined
    )
    expect(breakdown.totalSats).toBe(127)
    expect(breakdown.rows).toHaveLength(7)
    expect(breakdown.showBreakdown).toBe(true)
  })

  it('shows a refresh round as pending when nothing is spendable yet', () => {
    const breakdown = getArkBalanceBreakdown(
      buildBalance({ pendingInRoundSats: 1000 }),
      undefined
    )
    expect(breakdown.totalSats).toBe(1000)
    expect(breakdown.rows).toStrictEqual([
      { amountSats: 1000, key: 'pendingInRound' }
    ])
  })
})
