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
  claimableIds: string[]
  count: number
}

function rememberAnnouncedClaimable(
  accountId: string,
  claimableIds: string[]
): void {
  useArkExitClaimsStore
    .getState()
    .setAnnouncedClaimable(accountId, claimableIds)
}

async function findAccountNotice(
  account: ArkAccount
): Promise<ClaimableArkExitsNotice | undefined> {
  const exits = await refreshArkExits(account.id)
  const announcedIds =
    useArkExitClaimsStore.getState().announcedClaimableIds[account.id] ?? []
  const newIds = getNewlyClaimableArkExitIds(exits, announcedIds)
  const claimableIds = getClaimableArkExits(exits).map((exit) => exit.vtxoId)
  if (newIds.length === 0) {
    // Exits that stop being claimable are forgotten, so a return is announced.
    rememberAnnouncedClaimable(account.id, claimableIds)
    return undefined
  }
  return {
    accountId: account.id,
    accountName: account.name,
    claimableIds,
    count: newIds.length
  }
}

/** Call once the notice was shown, so the same exits are not announced again. */
function markArkExitsAnnounced({
  accountId,
  claimableIds
}: ClaimableArkExitsNotice): void {
  rememberAnnouncedClaimable(accountId, claimableIds)
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

export {
  type ClaimableArkExitsNotice,
  findNewlyClaimableArkExits,
  markArkExitsAnnounced
}
