import { create } from 'zustand'

import { type PaymentMethod } from '@/types/models/PaymentMethod'

type PendingZap = {
  noteNpub: string
  nostrUri: string
  invoice: string
  amountSats: number
  zapRequestJson: string
  paymentMethod: PaymentMethod
}

type ZapOutcome = 'success' | 'cancelled'

type ZapFlowState = {
  pendingZap: PendingZap | null
  zapResult: { invoice: string; outcome: ZapOutcome } | null
  setPendingZap: (zap: PendingZap) => void
  clearPendingZap: () => void
  clearZapResult: () => void
  reportZapOutcome: (invoice: string, outcome: ZapOutcome) => boolean
}

function normalizeInvoice(invoice: string) {
  return invoice
    .trim()
    .replace(/^lightning:/i, '')
    .toLowerCase()
}

/**
 * A pay screen reports the invoice it actually paid or gave up on. Only the
 * pending zap's own invoice settles the zap, so a zap the user abandoned
 * cannot turn a later, unrelated payment into a zap.
 */
export const useZapFlowStore = create<ZapFlowState>()((set, get) => ({
  clearPendingZap: () => set({ pendingZap: null }),
  clearZapResult: () => set({ zapResult: null }),
  pendingZap: null,
  reportZapOutcome: (invoice, outcome) => {
    const { pendingZap } = get()
    if (
      !pendingZap ||
      normalizeInvoice(pendingZap.invoice) !== normalizeInvoice(invoice)
    ) {
      return false
    }
    set({ zapResult: { invoice: pendingZap.invoice, outcome } })
    return true
  },
  setPendingZap: (zap) => set({ pendingZap: zap, zapResult: null }),
  zapResult: null
}))
