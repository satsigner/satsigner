import { create } from 'zustand'

/**
 * The seed of an identity being created, between the backup screen and the
 * profile screen. It lives only in memory: route params can be set by any
 * deep link, so the profile screen must never take keys from them.
 */
type NostrIdentityDraftState = {
  mnemonic: string | null
  clearDraft: () => void
  setDraftMnemonic: (mnemonic: string) => void
}

export const useNostrIdentityDraftStore = create<NostrIdentityDraftState>()(
  (set) => ({
    clearDraft: () => set({ mnemonic: null }),
    mnemonic: null,
    setDraftMnemonic: (mnemonic) => set({ mnemonic })
  })
)
