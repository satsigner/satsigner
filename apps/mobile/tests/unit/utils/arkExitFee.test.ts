import { estimateArkExitFeeSats } from '@/utils/ark'

describe('estimateArkExitFeeSats', () => {
  it('returns 0 without vtxos', () => {
    expect(estimateArkExitFeeSats([], 10)).toBe(0)
  })

  it('returns 0 without a positive fee rate', () => {
    expect(estimateArkExitFeeSats([{ exitDepth: 1 }], 0)).toBe(0)
    expect(estimateArkExitFeeSats([{ exitDepth: 1 }], -5)).toBe(0)
  })

  it('charges per exit level plus a claim tx, with safety multiplier', () => {
    // 1 vtxo, depth 1: (200 + 175) exit vbytes + (50 + 70) claim vbytes
    // = 495 vB * 2 sat/vB * 1.25 = 1237.5 -> 1238
    expect(estimateArkExitFeeSats([{ exitDepth: 1 }], 2)).toBe(1238)
  })

  it('scales with exit depth and vtxo count', () => {
    const vtxos = [{ exitDepth: 2 }, { exitDepth: 3 }]
    // exit: (2 + 3) * 375 = 1875 vB; claim: 50 + 70 * 2 = 190 vB
    // (1875 + 190) * 1 * 1.25 = 2581.25 -> 2582
    expect(estimateArkExitFeeSats(vtxos, 1)).toBe(2582)
  })

  it('treats a zero exit depth as a single level', () => {
    // same as depth 1
    expect(estimateArkExitFeeSats([{ exitDepth: 0 }], 2)).toBe(
      estimateArkExitFeeSats([{ exitDepth: 1 }], 2)
    )
  })
})
