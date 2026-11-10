import {
  createArkWallet,
  fetchArkOnchainFeeRates,
  openArkWallet,
  releaseAllArkWallets
} from '@/api/ark'
import { ARK_WALLET_LOCKED, ARK_WALLET_QUERY_KEY } from '@/constants/ark'
import { queryClient } from '@/lib/queryClient'
import { forgetAllArkNotificationSubscriptions } from '@/services/arkNotificationSubscriptions'
import { ensureArkDatadir } from '@/storage/arkDatadir'
import { getArkMnemonic } from '@/storage/encrypted'
import { getArkAccountOrThrow } from '@/store/ark'
import { useAuthStore } from '@/store/auth'
import type { ArkWalletArgs } from '@/types/models/Ark'
import { isAppLocked } from '@/utils/appLifecycle'
import { getArkServer } from '@/utils/ark'
import { devLog, devStep } from '@/utils/devConsole'

// Locking released every wallet. A caller still running from that session
// must not open or create one again behind the PIN screen. Checked right
// before the provider call, which from then on cancels with a later lock.
function throwIfAppLocked(): void {
  if (isAppLocked(useAuthStore.getState())) {
    throw new Error(ARK_WALLET_LOCKED)
  }
}

export async function ensureArkWalletOpen(accountId: string): Promise<true> {
  const account = getArkAccountOrThrow(accountId)

  const server = getArkServer(account.network, account.serverId)
  if (!server) {
    throw new Error('Ark server configuration missing')
  }

  const mnemonic = await getArkMnemonic(accountId)
  if (!mnemonic) {
    throw new Error('Ark mnemonic not found in secure storage')
  }

  const datadir = await ensureArkDatadir(accountId)
  await devStep('ark', `open wallet ${account.name}`)
  throwIfAppLocked()
  await openArkWallet({
    accountId,
    datadir,
    mnemonic,
    server
  })
  devLog('ark', `wallet open ${account.name}`)
  return true
}

export async function createArkWalletWhileUnlocked(
  args: ArkWalletArgs
): Promise<void> {
  throwIfAppLocked()
  await createArkWallet(args)
}

/**
 * Next-block fee rate on the Ark account's own network, read from its
 * on-chain wallet. The app-wide estimate follows the selected network, which
 * an Ark account need not share. Null when the estimate is unavailable.
 */
export function fetchArkNextBlockFeeRate(
  accountId: string
): Promise<number | null> {
  const { serverId } = getArkAccountOrThrow(accountId)
  return fetchArkOnchainFeeRates(serverId, accountId).then(
    (rates) => rates.fastSatPerVb,
    () => null
  )
}

/**
 * Releases every open Ark wallet. The subscriptions and the cached "wallet is
 * open" answers go too, so the next session opens each wallet again.
 */
export async function releaseAllArkWalletsAndSubscriptions(): Promise<void> {
  forgetAllArkNotificationSubscriptions()
  queryClient.removeQueries({ queryKey: ARK_WALLET_QUERY_KEY })
  await releaseAllArkWallets()
}
