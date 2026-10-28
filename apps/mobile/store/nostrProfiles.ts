import { create } from 'zustand'

import type { NostrKind0Profile } from '@/types/models/Nostr'

/** Kind 0 profiles by hex pubkey; null means relays had nothing for it. */
type NostrProfilesRecord = Record<string, NostrKind0Profile | null>

type NostrProfilesState = {
  profiles: NostrProfilesRecord
}

type NostrProfilesActions = {
  clearProfiles: () => void
  setProfiles: (
    requested: string[],
    found: Map<string, NostrKind0Profile>
  ) => void
}

const PROFILE_FIELDS: (keyof NostrKind0Profile)[] = [
  'banner',
  'displayName',
  'lud16',
  'nip05',
  'picture'
]

function isSameProfile(
  a: NostrKind0Profile | null | undefined,
  b: NostrKind0Profile | null | undefined
): boolean {
  if (!a || !b) {
    return a === b
  }
  return PROFILE_FIELDS.every((field) => a[field] === b[field])
}

function hasProfileChanges(
  current: NostrProfilesRecord,
  requested: string[],
  found: Map<string, NostrKind0Profile>
): boolean {
  return requested.some((pk) => {
    if (!(pk in current)) {
      return true
    }
    return found.has(pk) && !isSameProfile(found.get(pk), current[pk])
  })
}

/**
 * In-memory profiles for list rows (not persisted; SQLite is the cache).
 * The record keeps its identity until a profile actually changes, so rows
 * reading it don't re-render for nothing.
 */
const useNostrProfilesStore = create<
  NostrProfilesState & NostrProfilesActions
>()((set) => ({
  clearProfiles: () => set({ profiles: {} }),
  profiles: {},
  setProfiles: (requested, found) => {
    set((state) => {
      if (!hasProfileChanges(state.profiles, requested, found)) {
        return state
      }
      const next = { ...state.profiles }
      for (const pk of requested) {
        next[pk] = found.get(pk) ?? next[pk] ?? null
      }
      return { profiles: next }
    })
  }
}))

/** The requested profiles only; pair with `useShallow` for per-row selects. */
function pickNostrProfiles(
  profiles: NostrProfilesRecord,
  pubkeys: string[]
): NostrProfilesRecord {
  const picked: NostrProfilesRecord = {}
  for (const pk of pubkeys) {
    const key = pk.toLowerCase()
    if (key in profiles) {
      picked[key] = profiles[key]
    }
  }
  return picked
}

export { pickNostrProfiles, useNostrProfilesStore }
export type { NostrProfilesRecord }
