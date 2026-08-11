import type { QueryClient } from '@tanstack/react-query'

import { syncArkWallet } from '@/api/ark'
import { useArkStore } from '@/store/ark'
import {
  invalidateArkAccountQueries,
  syncArkAccountAndInvalidate
} from '@/utils/arkSync'

jest.mock<typeof import('@/api/ark')>('@/api/ark', () => ({
  syncArkWallet: jest.fn()
}))

const syncArkWalletMock = jest.mocked(syncArkWallet)

function buildQueryClient(): QueryClient {
  return {
    invalidateQueries: jest.fn().mockResolvedValue(undefined)
  } as Partial<QueryClient> as QueryClient
}

const ACCOUNT_ID = 'acc1'

describe('arkSync', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useArkStore.getState().clearAllData()
    useArkStore.getState().addAccount({
      bitcoinAccountId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      id: ACCOUNT_ID,
      name: 'Test',
      network: 'signet',
      serverId: 'second'
    })
  })

  it('invalidates balance, movements and vtxos queries', async () => {
    const queryClient = buildQueryClient()
    await invalidateArkAccountQueries(queryClient, ACCOUNT_ID)
    const keys = jest
      .mocked(queryClient.invalidateQueries)
      .mock.calls.map(([filters]) => filters?.queryKey)
    expect(keys).toStrictEqual([
      ['ark', 'balance', ACCOUNT_ID],
      ['ark', 'movements', ACCOUNT_ID],
      ['ark', 'vtxos', ACCOUNT_ID]
    ])
  })

  it('syncs the wallet then invalidates', async () => {
    syncArkWalletMock.mockResolvedValue(undefined)
    const queryClient = buildQueryClient()
    await syncArkAccountAndInvalidate(queryClient, ACCOUNT_ID)
    expect(syncArkWalletMock).toHaveBeenCalledWith('second', ACCOUNT_ID)
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(3)
  })

  it('still invalidates when the wallet sync fails', async () => {
    syncArkWalletMock.mockRejectedValue(new Error('network down'))
    const queryClient = buildQueryClient()
    await expect(
      syncArkAccountAndInvalidate(queryClient, ACCOUNT_ID)
    ).resolves.toBeUndefined()
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(3)
  })

  it('never rejects even when invalidation fails', async () => {
    syncArkWalletMock.mockResolvedValue(undefined)
    const queryClient = {
      invalidateQueries: jest.fn().mockRejectedValue(new Error('boom'))
    } as Partial<QueryClient> as QueryClient
    await expect(
      syncArkAccountAndInvalidate(queryClient, ACCOUNT_ID)
    ).resolves.toBeUndefined()
  })

  it('skips the wallet sync for an unknown account but still invalidates', async () => {
    const queryClient = buildQueryClient()
    await syncArkAccountAndInvalidate(queryClient, 'missing')
    expect(syncArkWalletMock).not.toHaveBeenCalled()
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(3)
  })
})
