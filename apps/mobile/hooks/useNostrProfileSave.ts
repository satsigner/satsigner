import { useMutation } from '@tanstack/react-query'

import { NostrAPI } from '@/api/nostr'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { useNostrProfilesStore } from '@/store/nostrProfiles'
import {
  type NostrIdentity,
  type NostrKind0Profile
} from '@/types/models/Nostr'
import { getChangedProfileFields, getPubKeyHexFromNpub } from '@/utils/nostr'
import { getNostrIdentityRelays } from '@/utils/nostrContacts'

function getLocalProfile(identity: NostrIdentity): NostrKind0Profile {
  return {
    banner: identity.banner,
    displayName: identity.displayName,
    lud16: identity.lud16,
    nip05: identity.nip05,
    picture: identity.picture
  }
}

/** The profile as published, which keeps fields changed on other clients. */
function publishProfileChanges(
  identity: NostrIdentity,
  profile: NostrKind0Profile,
  relays: string[]
): Promise<NostrKind0Profile> {
  const localProfile = getLocalProfile(identity)
  const changes = getChangedProfileFields(localProfile, profile)
  if (!identity.nsec || Object.keys(changes).length === 0) {
    return Promise.resolve(profile)
  }
  return new NostrAPI(relays).publishProfile(
    identity.nsec,
    changes,
    localProfile
  )
}

/** Feed rows read the profiles cache, not the identity. */
function showProfileInFeeds(npub: string, profile: NostrKind0Profile) {
  const pubkeyHex = getPubKeyHexFromNpub(npub)
  if (!pubkeyHex) {
    return
  }
  useNostrProfilesStore
    .getState()
    .setProfiles([pubkeyHex], new Map([[pubkeyHex, profile]]))
}

/**
 * With relay sync on, the profile is published as kind 0 before it is saved
 * on the device: an unpublished edit would be overwritten by the next sync.
 */
function useNostrProfileSave(identity: NostrIdentity | undefined) {
  const globalRelays = useNostrIdentityStore((state) => state.relays)
  const updateIdentity = useNostrIdentityStore((state) => state.updateIdentity)
  const publishes = Boolean(identity?.nsec && identity.relayConnected)

  const mutation = useMutation({
    mutationFn: async (profile: NostrKind0Profile) => {
      if (!identity) {
        return
      }
      if (!publishes) {
        updateIdentity(identity.npub, profile)
        return
      }
      const relays = getNostrIdentityRelays(identity.relays, globalRelays)
      const published = await publishProfileChanges(identity, profile, relays)
      updateIdentity(identity.npub, published)
      showProfileInFeeds(identity.npub, published)
    }
  })

  return { ...mutation, publishes }
}

export { useNostrProfileSave }
