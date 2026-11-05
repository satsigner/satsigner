import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'
import { type ArkExit, type ArkExitClaimRecord } from '@/types/models/Ark'
import { pruneArkExitClaimRecords } from '@/utils/arkExit'

type ArkExitClaimsState = {
  claims: ArkExitClaimRecord[]
  // Exits the user was already told are claimable, by Ark account.
  announcedClaimableIds: Record<string, string[]>
}

type ArkExitClaimsAction = {
  saveClaim: (record: ArkExitClaimRecord) => void
  removeClaim: (txid: string) => void
  // No-op when the record is gone, e.g. after a wipe while it was broadcast.
  updateClaimStatus: (
    txid: string,
    broadcastStatus: ArkExitClaimRecord['broadcastStatus']
  ) => void
  pruneAccountClaims: (arkAccountId: string, exits: ArkExit[]) => void
  setAnnouncedClaimable: (arkAccountId: string, vtxoIds: string[]) => void
  removeAccountData: (arkAccountId: string) => void
  clearAllData: () => void
}

export const useArkExitClaimsStore = create<
  ArkExitClaimsState & ArkExitClaimsAction
>()(
  persist(
    (set) => ({
      announcedClaimableIds: {},
      claims: [],
      clearAllData: () => set({ announcedClaimableIds: {}, claims: [] }),
      pruneAccountClaims: (arkAccountId, exits) =>
        set((state) => ({
          claims: pruneArkExitClaimRecords(state.claims, arkAccountId, exits)
        })),
      removeAccountData: (arkAccountId) =>
        set((state) => ({
          announcedClaimableIds: Object.fromEntries(
            Object.entries(state.announcedClaimableIds).filter(
              ([accountId]) => accountId !== arkAccountId
            )
          ),
          claims: state.claims.filter(
            (claim) => claim.arkAccountId !== arkAccountId
          )
        })),
      removeClaim: (txid) =>
        set((state) => ({
          claims: state.claims.filter((claim) => claim.txid !== txid)
        })),
      saveClaim: (record) =>
        set((state) => ({
          claims: [
            record,
            ...state.claims.filter((claim) => claim.txid !== record.txid)
          ]
        })),
      setAnnouncedClaimable: (arkAccountId, vtxoIds) =>
        set((state) => ({
          announcedClaimableIds: {
            ...state.announcedClaimableIds,
            [arkAccountId]: vtxoIds
          }
        })),
      updateClaimStatus: (txid, broadcastStatus) =>
        set((state) => ({
          claims: state.claims.map((claim) =>
            claim.txid === txid ? { ...claim, broadcastStatus } : claim
          )
        }))
    }),
    {
      name: 'satsigner-ark-exit-claims',
      partialize: (state) => ({
        announcedClaimableIds: state.announcedClaimableIds,
        claims: state.claims
      }),
      storage: createJSONStorage(() => mmkvStorage),
      version: 1
    }
  )
)

export function getArkExitClaimRecord(
  txid: string
): ArkExitClaimRecord | undefined {
  return useArkExitClaimsStore
    .getState()
    .claims.find((claim) => claim.txid === txid)
}

export function getArkAccountExitClaims(
  arkAccountId: string
): ArkExitClaimRecord[] {
  return useArkExitClaimsStore
    .getState()
    .claims.filter((claim) => claim.arkAccountId === arkAccountId)
}
