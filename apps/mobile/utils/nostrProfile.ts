import type { NostrIdentity, NostrKind0Profile } from '@/types/models/Nostr'

/**
 * Identity fields from a kind 0 profile. The profile replaces what the
 * identity had: a field the user removed on another client is removed here.
 */
function getIdentityProfileUpdate(
  profile: NostrKind0Profile
): Pick<
  NostrIdentity,
  'banner' | 'displayName' | 'lud16' | 'nip05' | 'picture'
> {
  return {
    banner: profile.banner,
    displayName: profile.displayName,
    lud16: profile.lud16,
    nip05: profile.nip05,
    picture: profile.picture
  }
}

export { getIdentityProfileUpdate }
