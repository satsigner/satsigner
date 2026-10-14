import { mainRed, warning, white } from '@/styles/colors'
import {
  getNodeParagraphLayoutWidth,
  getUnspentOutputSatsColor,
  NODE_TEXT_OVERFLOW_WIDTH,
  resolveChartOutputSpendStatus
} from '@/utils/sankeyOutputLabel'

describe('getNodeParagraphLayoutWidth', () => {
  it('keeps narrow output nodes wide enough for amount and unit', () => {
    expect(getNodeParagraphLayoutWidth(40, 8, false)).toBe(
      NODE_TEXT_OVERFLOW_WIDTH
    )
  })

  it('uses the node width when it is wider than the overflow width', () => {
    expect(getNodeParagraphLayoutWidth(300, 8, false)).toBe(292)
  })

  it('uses a share of the node width for block nodes', () => {
    expect(getNodeParagraphLayoutWidth(100, 8, true)).toBe(60)
  })
})

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

describe('resolveChartOutputSpendStatus', () => {
  const outpoint = 'abcd:0'

  it('defaults to unspent when no UTXO set is provided', () => {
    expect(
      resolveChartOutputSpendStatus({
        outpoint
      })
    ).toBe('unspent')
  })

  it('marks outputs in the UTXO set as unspent', () => {
    expect(
      resolveChartOutputSpendStatus({
        outpoint,
        unspentOutpoints: new Set([outpoint])
      })
    ).toBe('unspent')
  })

  it('marks outputs with a known spending tx as spent', () => {
    expect(
      resolveChartOutputSpendStatus({
        outpoint,
        spendingTxIdsByOutpoint: new Map([[outpoint, 'nexttxid']]),
        unspentOutpoints: new Set()
      })
    ).toBe('spent')
  })

  it('marks uncertain outputs as pending for a node outspend check', () => {
    expect(
      resolveChartOutputSpendStatus({
        outpoint,
        unspentOutpoints: new Set()
      })
    ).toBe('pending')
  })
})
