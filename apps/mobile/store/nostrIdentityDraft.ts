import { create } from 'zustand'

import { randomUuid } from '@/utils/crypto'

/**
 * The seed of an identity being created, between the backup screen and the
 * profile screen. It lives only in memory: route params can be set by any
 * deep link, so the profile screen must never take keys from them. It gets
 * the seed only when opened with the id of the current draft, so a link can't
 * bring back a seed the user abandoned.
 */
type NostrIdentityDraftState = {
  draftId: string | null
  mnemonic: string | null
  clearDraft: () => void
  startDraft: (mnemonic: string) => string
}

export const useNostrIdentityDraftStore = create<NostrIdentityDraftState>()(
  (set) => ({
    clearDraft: () => set({ draftId: null, mnemonic: null }),
    draftId: null,
    mnemonic: null,
    startDraft: (mnemonic) => {
      const draftId = randomUuid()
      set({ draftId, mnemonic })
      return draftId
    }
  })
)

export function selectDraftMnemonic(
  state: Pick<NostrIdentityDraftState, 'draftId' | 'mnemonic'>,
  draftId: string | undefined
): string | null {
  return draftId && state.draftId === draftId ? state.mnemonic : null
}
