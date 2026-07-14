import { mainRed, warning, white } from '@/styles/colors'
import { getUnspentOutputSatsColor } from '@/utils/sankeyOutputLabel'

describe('getUnspentOutputSatsColor', () => {
  it('uses warning when output exceeds max allowed sats', () => {
    expect(
      getUnspentOutputSatsColor({
        isChange: false,
        isGreenOutput: false,
        isMiningFee: false,
        maxAllowedSats: 40_000,
        value: 50_000
      })
    ).toBe(warning)
  })

  it('uses white when output is within max allowed sats', () => {
    expect(
      getUnspentOutputSatsColor({
        isChange: false,
        isGreenOutput: false,
        isMiningFee: false,
        maxAllowedSats: 40_000,
        value: 30_000
      })
    ).toBe(white)
  })

  it('keeps default unspent colors when max allowed is not set', () => {
    expect(
      getUnspentOutputSatsColor({
        isChange: false,
        isGreenOutput: false,
        isMiningFee: false,
        value: 30_000
      })
    ).toBe(mainRed)
  })
})
