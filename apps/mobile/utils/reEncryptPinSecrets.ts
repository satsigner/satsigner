import { type Account } from '@/types/models/Account'
import { listPinSecretSlots, rekeyPinSecrets } from '@/utils/pinRekey'

/**
 * Re-encrypts every PIN-bound secret (account keys, nostr nsecs, LND/RPC)
 * from one digest to another, all or nothing. The caller commits the new
 * digest and then clears the re-key journal.
 */
export async function reEncryptPinBoundSecrets(
  oldDigest: string,
  newDigest: string,
  accounts: Account[]
): Promise<void> {
  const { useNostrIdentityStore } = await import('@/store/nostrIdentity')
  const identityNpubs = useNostrIdentityStore
    .getState()
    .identities.map((identity) => identity.npub)
  await rekeyPinSecrets(
    oldDigest,
    newDigest,
    listPinSecretSlots(accounts, identityNpubs)
  )
}
