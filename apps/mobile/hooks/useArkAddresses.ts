import { useQuery } from '@tanstack/react-query'

import { deriveArkAddresses } from '@/api/ark'
import { DEFAULT_STOP_GAP } from '@/config/servers'
import { ARK_ADDRESS_MAX_SCAN } from '@/constants/ark'
import { useArkStore } from '@/store/ark'
import type { ArkAddress } from '@/types/models/Ark'
import { getArkAccountOrThrow } from '@/utils/ark'
import {
  buildArkReceiveInfo,
  countUsedArkAddresses,
  scanArkAddresses,
  withArkDerivedAddressCache
} from '@/utils/arkAddress'

import { useArkMovements } from './useArkMovements'
import { useArkWallet } from './useArkWallet'

type UseArkAddressesResult = {
  addresses: ArkAddress[]
  isLoading: boolean
  error: Error | null
}

const EMPTY_ADDRESSES: ArkAddress[] = []

export function useArkAddresses(
  accountId: string | null | undefined
): UseArkAddressesResult {
  const { data: walletReady } = useArkWallet(accountId)
  const movementsQuery = useArkMovements(accountId)
  const movements = movementsQuery.data

  const updateStats = useArkStore((state) => state.updateStats)

  const addressesQuery = useQuery<ArkAddress[]>({
    enabled: Boolean(walletReady && accountId) && movements !== undefined,
    queryFn: async () => {
      if (!accountId) {
        throw new Error('Ark account id is required')
      }
      const account = getArkAccountOrThrow(accountId)
      const receiveInfo = buildArkReceiveInfo(movements ?? [])
      const addresses = await scanArkAddresses(
        withArkDerivedAddressCache(accountId, (startIndex, count) =>
          deriveArkAddresses(account.serverId, accountId, startIndex, count)
        ),
        receiveInfo,
        DEFAULT_STOP_GAP,
        ARK_ADDRESS_MAX_SCAN
      )
      updateStats(accountId, {
        numberOfAddresses: countUsedArkAddresses(addresses)
      })
      return addresses
    },
    queryKey: ['ark', 'addresses', accountId, movements?.length ?? 0],
    staleTime: 60_000
  })

  return {
    addresses: addressesQuery.data ?? EMPTY_ADDRESSES,
    error: addressesQuery.error ?? movementsQuery.error,
    isLoading: movementsQuery.isLoading || addressesQuery.isLoading
  }
}
