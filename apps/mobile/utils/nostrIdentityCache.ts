import { resetProfileFetcher } from '@/api/nostrProfileFetcher'
import { nostrKeys } from '@/db/keys'
import { queryClient } from '@/lib/queryClient'
import { useNostrProfilesStore } from '@/store/nostrProfiles'
import { clearNoteContentCache } from '@/utils/nostrNoteContent'

/** Query prefixes whose data is derived from the nostr SQLite cache. */
const NOSTR_IDENTITY_QUERY_PREFIXES = [
  nostrKeys.identity,
  ['nostr', 'contacts'],
  ['nostr', 'profile'],
  ['nostr', 'contact-profile']
]

/**
 * After the SQLite cache is cleared, drops everything held in memory that
 * was built from it, so screens refetch instead of showing removed data.
 */
async function resetNostrIdentityMemory(): Promise<void> {
  resetProfileFetcher()
  clearNoteContentCache()
  useNostrProfilesStore.getState().clearProfiles()
  await Promise.all(
    NOSTR_IDENTITY_QUERY_PREFIXES.map((queryKey) =>
      queryClient.resetQueries({ queryKey })
    )
  )
}

export { resetNostrIdentityMemory }
