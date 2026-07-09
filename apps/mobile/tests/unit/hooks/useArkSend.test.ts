import {
  payArkBolt11,
  payArkLightningAddress,
  sendArkArkoor,
  sendArkOnchain
} from '@/api/ark'
import { executeArkSend } from '@/hooks/useArkSend'
import { useArkStore } from '@/store/ark'
import { handleLNURLPay } from '@/utils/lnurl'

jest.mock<typeof import('@/api/ark')>('@/api/ark', () => ({
  payArkBolt11: jest.fn(),
  payArkLightningAddress: jest.fn(),
  sendArkArkoor: jest.fn(),
  sendArkOnchain: jest.fn()
}))

jest.mock<typeof import('@/utils/lnurl')>('@/utils/lnurl', () => ({
  handleLNURLPay: jest.fn()
}))

const ACCOUNT_ID = 'acc1'
const SERVER_ID = 'second'

describe('executeArkSend', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useArkStore.getState().clearAllData()
    useArkStore.getState().addAccount({
      bitcoinAccountId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      id: ACCOUNT_ID,
      name: 'Test',
      network: 'signet',
      serverId: SERVER_ID
    })
  })

  it('throws for an unknown account', async () => {
    await expect(
      executeArkSend('missing', {
        address: 'ark1abc',
        amountSats: 100,
        kind: 'arkoor'
      })
    ).rejects.toThrow('Ark account not found')
  })

  it('routes arkoor sends to sendArkArkoor', async () => {
    jest.mocked(sendArkArkoor).mockResolvedValue(undefined)
    const outcome = await executeArkSend(ACCOUNT_ID, {
      address: 'ark1abc',
      amountSats: 100,
      kind: 'arkoor'
    })
    expect(sendArkArkoor).toHaveBeenCalledWith(
      SERVER_ID,
      ACCOUNT_ID,
      'ark1abc',
      100
    )
    expect(outcome).toStrictEqual({
      amountSats: 100,
      kind: 'arkoor'
    })
  })

  it('routes bolt11 sends to payArkBolt11', async () => {
    jest.mocked(payArkBolt11).mockResolvedValue({
      amountSats: 100,
      htlcVtxoCount: 0,
      invoice: 'lnbc1invoice',
      preimage: 'pre'
    })
    const outcome = await executeArkSend(ACCOUNT_ID, {
      amountSats: 100,
      invoice: 'lnbc1invoice',
      kind: 'bolt11'
    })
    expect(payArkBolt11).toHaveBeenCalledWith(
      SERVER_ID,
      ACCOUNT_ID,
      'lnbc1invoice',
      100
    )
    expect(outcome).toStrictEqual({
      amountSats: 100,
      invoice: 'lnbc1invoice',
      kind: 'bolt11',
      preimage: 'pre'
    })
  })

  it('routes lightning-address sends to payArkLightningAddress', async () => {
    jest.mocked(payArkLightningAddress).mockResolvedValue({
      amountSats: 250,
      htlcVtxoCount: 0,
      invoice: 'lnbc1resolved',
      preimage: 'pre'
    })
    const outcome = await executeArkSend(ACCOUNT_ID, {
      address: 'user@ln.example',
      amountSats: 250,
      comment: 'hi',
      kind: 'lnaddress'
    })
    expect(payArkLightningAddress).toHaveBeenCalledWith(
      SERVER_ID,
      ACCOUNT_ID,
      'user@ln.example',
      250,
      'hi'
    )
    expect(outcome.kind).toBe('lnaddress')
  })

  it('routes onchain sends to sendArkOnchain', async () => {
    jest.mocked(sendArkOnchain).mockResolvedValue('txid2')
    const outcome = await executeArkSend(ACCOUNT_ID, {
      address: 'tb1qaddress',
      amountSats: 500,
      kind: 'onchain'
    })
    expect(sendArkOnchain).toHaveBeenCalledWith(
      SERVER_ID,
      ACCOUNT_ID,
      'tb1qaddress',
      500
    )
    expect(outcome).toStrictEqual({
      amountSats: 500,
      kind: 'onchain',
      txid: 'txid2'
    })
  })

  it('resolves an LNURL to an invoice and pays it via payArkBolt11', async () => {
    jest.mocked(handleLNURLPay).mockResolvedValue('lnbc1fromlnurl')
    jest.mocked(payArkBolt11).mockResolvedValue({
      amountSats: 300,
      htlcVtxoCount: 0,
      invoice: 'lnbc1fromlnurl',
      preimage: 'pre'
    })
    const outcome = await executeArkSend(ACCOUNT_ID, {
      amountSats: 300,
      comment: 'zap',
      kind: 'lnurl',
      lnurl: 'lnurl1encoded'
    })
    expect(handleLNURLPay).toHaveBeenCalledWith('lnurl1encoded', 300, 'zap')
    expect(payArkBolt11).toHaveBeenCalledWith(
      SERVER_ID,
      ACCOUNT_ID,
      'lnbc1fromlnurl',
      300
    )
    expect(outcome.kind).toBe('lnurl')
  })
})
