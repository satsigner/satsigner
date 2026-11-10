import { releaseAllArkWalletsAndSubscriptions } from '@/services/arkWallet'
import { stopAllNip46Sessions } from '@/services/nip46Sessions'
import { useNip46Store } from '@/store/nip46'
import { devLog } from '@/utils/devConsole'
import { clearNostrSecretsCaches } from '@/utils/nostrSecrets'

/**
 * Drops what an unlocked session keeps live in memory: bunker sessions signing
 * for nostr identities, their unanswered requests, decrypted nostr secrets and
 * open Ark wallets with their daemons. The next unlock loads them again.
 */
export async function teardownUnlockedSession(): Promise<void> {
  try {
    stopAllNip46Sessions()
    clearNostrSecretsCaches()
    useNip46Store.getState().markSessionsDisconnected()
  } finally {
    // The wipe deletes the Ark datadirs next, so the daemons stop regardless.
    await releaseAllArkWalletsAndSubscriptions()
  }
}

export async function teardownUnlockedSessionSafe(): Promise<void> {
  try {
    await teardownUnlockedSession()
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    devLog('session', `teardown failed: ${reason}`, 'error')
  }
}
