import { create } from 'zustand'

import { type PaymentMethod } from '@/components/SSPaymentMethodPicker'

type PendingZap = {
  noteNpub: string
  nostrUri: string
  invoice: string
  amountSats: number
  zapRequestJson: string
  paymentMethod: PaymentMethod
}

type ZapFlowState = {
  pendingZap: PendingZap | null
  zapResult: 'success' | 'cancelled' | null
  setPendingZap: (zap: PendingZap) => void
  clearPendingZap: () => void
  setZapResult: (result: 'success' | 'cancelled' | null) => void
}

export const useZapFlowStore = create<ZapFlowState>()((set) => ({
  pendingZap: null,
  zapResult: null,
  setPendingZap: (zap) => set({ pendingZap: zap, zapResult: null }),
  clearPendingZap: () => set({ pendingZap: null }),
  setZapResult: (result) => set({ zapResult: result })
}))
