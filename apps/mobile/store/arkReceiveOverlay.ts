import { create } from 'zustand'

import type { ArkReceiveOverlayEvent } from '@/types/models/Ark'

type ArkReceiveOverlayState = {
  queue: ArkReceiveOverlayEvent[]
}

type ArkReceiveOverlayAction = {
  enqueueReceive: (event: ArkReceiveOverlayEvent) => void
  dismissReceive: () => void
}

export const useArkReceiveOverlayStore = create<
  ArkReceiveOverlayState & ArkReceiveOverlayAction
>()((set) => ({
  dismissReceive: () => set((state) => ({ queue: state.queue.slice(1) })),
  enqueueReceive: (event) =>
    set((state) => ({ queue: [...state.queue, event] })),
  queue: []
}))
