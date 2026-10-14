import { formatNetworkHashRate } from '@/utils/energyRpc'

describe('formatNetworkHashRate', () => {
  it('formats hash rate in EH/s', () => {
    expect(formatNetworkHashRate('main', 812_340_000_000_000_000_000)).toBe(
      '812.34'
    )
  })

  it('reports no data on regtest', () => {
    expect(formatNetworkHashRate('regtest', undefined)).toBe('no data')
  })

  it('falls back to zero before the chain or rate is known', () => {
    expect(formatNetworkHashRate(undefined, 1e18)).toBe('0')
    expect(formatNetworkHashRate('signet', undefined)).toBe('0')
  })
})
