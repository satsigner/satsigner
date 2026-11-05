import { refreshArkExits } from '@/services/arkExitClaim'
import { useArkStore } from '@/store/ark'
import { useArkExitClaimsStore } from '@/store/arkExitClaims'
import { type ArkAccount } from '@/types/models/Ark'
import {
  getClaimableArkExits,
  getNewlyClaimableArkExitIds
} from '@/utils/arkExit'

type ClaimableArkExitsNotice = {
  accountId: string
  accountName: string
  count: number
}

async function findAccountNotice(
  account: ArkAccount
): Promise<ClaimableArkExitsNotice | undefined> {
  const exits = await refreshArkExits(account.id)
  const store = useArkExitClaimsStore.getState()
  const announcedIds = store.announcedClaimableIds[account.id] ?? []
  const newIds = getNewlyClaimableArkExitIds(exits, announcedIds)
  // Exits that stop being claimable are forgotten, so a return is announced.
  store.setAnnouncedClaimable(
    account.id,
    getClaimableArkExits(exits).map((exit) => exit.vtxoId)
  )
  if (newIds.length === 0) {
    return undefined
  }
  return {
    accountId: account.id,
    accountName: account.name,
    count: newIds.length
  }
}

/** Ark accounts with exits that became claimable since the last check. */
async function findNewlyClaimableArkExits(): Promise<
  ClaimableArkExitsNotice[]
> {
  const { accounts, balances } = useArkStore.getState()
  const exiting = accounts.filter(
    (account) => (balances[account.id]?.pendingExitSats ?? 0) > 0
  )
  const results = await Promise.allSettled(exiting.map(findAccountNotice))
  return results.flatMap((result) =>
    result.status === 'fulfilled' && result.value ? [result.value] : []
  )
}

export { type ClaimableArkExitsNotice, findNewlyClaimableArkExits }
