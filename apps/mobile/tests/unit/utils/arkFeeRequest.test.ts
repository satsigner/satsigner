import { estimateArkFee } from '@/api/ark'
import { getArkProvider } from '@/api/ark/registry'
import {
  arkSendFeeRequest,
  isArkFeeRequestReady,
  normalizeArkFeeRequest
} from '@/utils/ark'

jest.mock<typeof import('@/api/ark/providers/bark')>(
  '@/api/ark/providers/bark',
  () => ({})
)
jest.mock<typeof import('@/api/ark/registry')>('@/api/ark/registry', () => ({
  getArkProvider: jest.fn()
}))

const ADDRESS = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'

describe('isArkFeeRequestReady', () => {
  it('requires a positive amount', () => {
    expect(isArkFeeRequestReady({ amountSats: 0, kind: 'board' })).toBe(false)
    expect(isArkFeeRequestReady({ amountSats: 1, kind: 'board' })).toBe(true)
  })

  it('requires a non-blank address', () => {
    expect(
      isArkFeeRequestReady({ address: '  ', amountSats: 1, kind: 'onchain' })
    ).toBe(false)
  })

  it('requires vtxos', () => {
    expect(isArkFeeRequestReady({ kind: 'refresh', vtxoIds: [] })).toBe(false)
    expect(
      isArkFeeRequestReady({
        address: ADDRESS,
        kind: 'offboard',
        vtxoIds: ['a']
      })
    ).toBe(true)
  })
})

describe('normalizeArkFeeRequest', () => {
  it('trims the address and sorts vtxo ids', () => {
    expect(
      normalizeArkFeeRequest({
        address: ` ${ADDRESS} `,
        kind: 'offboard',
        vtxoIds: ['b', 'a']
      })
    ).toStrictEqual({ address: ADDRESS, kind: 'offboard', vtxoIds: ['a', 'b'] })
  })
})

describe('arkSendFeeRequest', () => {
  it('maps each destination to its fee kind', () => {
    expect(
      arkSendFeeRequest({ address: 'ark1x', kind: 'arkoor' }, 5)
    ).toStrictEqual({
      amountSats: 5,
      kind: 'arkoor'
    })
    expect(
      arkSendFeeRequest({ address: ADDRESS, kind: 'onchain' }, 5)
    ).toStrictEqual({ address: ADDRESS, amountSats: 5, kind: 'onchain' })
    expect(
      arkSendFeeRequest({ invoice: 'lnbc1', kind: 'bolt11' }, 5)
    ).toStrictEqual({
      amountSats: 5,
      kind: 'lightning'
    })
  })
})

describe('estimateArkFee', () => {
  it('dispatches each kind to its provider call', async () => {
    const provider = {
      estimateBoardFee: jest.fn().mockResolvedValue('board'),
      estimateOffboardFee: jest.fn().mockResolvedValue('offboard'),
      estimateRefreshFee: jest.fn().mockResolvedValue('refresh'),
      estimateSendOnchainFee: jest.fn().mockResolvedValue('onchain')
    }
    jest.mocked(getArkProvider).mockReturnValue(provider as never)

    await expect(
      estimateArkFee('second', 'acc', { amountSats: 10, kind: 'board' })
    ).resolves.toBe('board')
    await expect(
      estimateArkFee('second', 'acc', {
        address: ADDRESS,
        amountSats: 10,
        kind: 'onchain'
      })
    ).resolves.toBe('onchain')
    await expect(
      estimateArkFee('second', 'acc', {
        address: ADDRESS,
        kind: 'offboard',
        vtxoIds: ['a']
      })
    ).resolves.toBe('offboard')
    await expect(
      estimateArkFee('second', 'acc', { kind: 'refresh', vtxoIds: ['a'] })
    ).resolves.toBe('refresh')

    expect(provider.estimateOffboardFee).toHaveBeenCalledWith('acc', ADDRESS, [
      'a'
    ])
  })
})
