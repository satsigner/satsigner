import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { DEV_CONSOLE_MAX_ENTRIES } from '@/constants/devConsole'
import mmkvStorage from '@/storage/mmkv'
import type { DevConsoleEntry } from '@/types/models/DevConsole'

type DevConsoleState = {
  enabled: boolean
  entries: DevConsoleEntry[]
  panelOpen: boolean
  pausedSteps: string[]
  previousEntries: DevConsoleEntry[]
  showPrevious: boolean
  stepMode: boolean
}

type DevConsoleAction = {
  addEntry: (entry: DevConsoleEntry) => void
  clearEntries: () => void
  setEnabled: (enabled: boolean) => void
  setPanelOpen: (open: boolean) => void
  setPausedSteps: (steps: string[]) => void
  setPreviousEntries: (entries: DevConsoleEntry[]) => void
  setShowPrevious: (showPrevious: boolean) => void
  setStepMode: (stepMode: boolean) => void
}

export const useDevConsoleStore = create<DevConsoleState & DevConsoleAction>()(
  persist(
    (set) => ({
      addEntry: (entry) =>
        set((state) => ({
          entries: [...state.entries, entry].slice(-DEV_CONSOLE_MAX_ENTRIES)
        })),
      clearEntries: () => set({ entries: [], previousEntries: [] }),
      enabled: true,
      entries: [],
      panelOpen: false,
      pausedSteps: [],
      previousEntries: [],
      setEnabled: (enabled) => set({ enabled }),
      setPanelOpen: (panelOpen) => set({ panelOpen }),
      setPausedSteps: (pausedSteps) => set({ pausedSteps }),
      setPreviousEntries: (previousEntries) => set({ previousEntries }),
      setShowPrevious: (showPrevious) => set({ showPrevious }),
      setStepMode: (stepMode) => set({ stepMode }),
      showPrevious: false,
      stepMode: false
    }),
    {
      name: 'satsigner-dev-console',
      // Only the switches persist; Pause must survive a restart so startup
      // can stop before its first step.
      partialize: (state) => ({
        enabled: state.enabled,
        stepMode: state.stepMode
      }),
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)
