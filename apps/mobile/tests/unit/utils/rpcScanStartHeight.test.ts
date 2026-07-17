import {
  computeRpcScanStartHeight,
  estimateBirthHeight
} from '@/utils/rpcScanStartHeight'

describe('computeRpcScanStartHeight', () => {
  const tip = 300_000

  it('prefers an explicit rpcScanFromHeight floor', () => {
    expect(
      computeRpcScanStartHeight({
        birthdayDate: new Date('2024-01-01'),
        currentTip: tip,
        rpcScanFromHeight: 250_000
      })
    ).toBe(250_000)
  })

  it('estimates from birthday relative to tip', () => {
    const birthday = new Date(Date.now() - 10 * 60 * 1000) // ~1 block ago
    const height = computeRpcScanStartHeight({
      birthdayDate: birthday,
      currentTip: tip
    })
    // Buffer pulls start further back than tip-1
    expect(height).toBeLessThan(tip)
    expect(height).toBe(estimateBirthHeight(birthday, tip))
  })

  it('falls back to checkpoint when birthday is missing', () => {
    expect(
      computeRpcScanStartHeight({
        checkpointHeight: 100_000,
        currentTip: tip
      })
    ).toBe(100_000 - 2016)
  })

  it('falls back to genesis when nothing else is available', () => {
    expect(computeRpcScanStartHeight({ currentTip: tip })).toBe(0)
  })
})
