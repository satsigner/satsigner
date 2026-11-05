import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'
import { type ArkSwapJob } from '@/types/models/ArkSwap'

type ArkSwapsState = {
  jobs: ArkSwapJob[]
}

type ArkSwapsAction = {
  saveJob: (job: ArkSwapJob) => void
  removeJob: (jobId: string) => void
  removeAccountJobs: (arkAccountId: string) => void
  clearAllData: () => void
}

export const useArkSwapsStore = create<ArkSwapsState & ArkSwapsAction>()(
  persist(
    (set) => ({
      clearAllData: () => set({ jobs: [] }),
      jobs: [],
      removeAccountJobs: (arkAccountId) =>
        set((state) => ({
          jobs: state.jobs.filter((job) => job.arkAccountId !== arkAccountId)
        })),
      removeJob: (jobId) =>
        set((state) => ({
          jobs: state.jobs.filter((job) => job.id !== jobId)
        })),
      saveJob: (job) =>
        set((state) => {
          const exists = state.jobs.some((existing) => existing.id === job.id)
          return {
            jobs: exists
              ? state.jobs.map((existing) =>
                  existing.id === job.id ? job : existing
                )
              : [job, ...state.jobs]
          }
        })
    }),
    {
      name: 'satsigner-ark-swaps',
      partialize: (state) => ({ jobs: state.jobs }),
      storage: createJSONStorage(() => mmkvStorage),
      version: 1
    }
  )
)

export function getArkSwapJob(jobId: string): ArkSwapJob | undefined {
  return useArkSwapsStore.getState().jobs.find((job) => job.id === jobId)
}
