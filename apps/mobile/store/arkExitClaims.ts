import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'
import { type ArkExit, type ArkExitClaimRecord } from '@/types/models/Ark'
import { getClaimableArkExits, pruneArkExitClaimRecords } from '@/utils/arkExit'

type ArkExitClaimsState = {
  claims: ArkExitClaimRecord[]
  // Exits the user was already told are claimable, by Ark account.
  announcedClaimableIds: Record<string, string[]>
}

type ArkExitClaimsAction = {
  saveClaim: (record: ArkExitClaimRecord) => void
  removeClaim: (txid: string) => void
  reconcileAccount: (arkAccountId: string, exits: ArkExit[]) => void
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
      reconcileAccount: (arkAccountId, exits) =>
        set((state) => ({
          announcedClaimableIds: {
            ...state.announcedClaimableIds,
            [arkAccountId]: getClaimableArkExits(exits).map(
              (exit) => exit.vtxoId
            )
          },
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
