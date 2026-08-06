import { type PayjoinSessionStatus } from '@/types/payjoin'

const PAYJOIN_TERMINAL_STATUSES = new Set<PayjoinSessionStatus>([
  'cancelled',
  'completed',
  'error',
  'expired',
  'fallback'
])

function isPayjoinTerminal(status: PayjoinSessionStatus): boolean {
  return PAYJOIN_TERMINAL_STATUSES.has(status)
}

function isPayjoinSuccess(status: PayjoinSessionStatus): boolean {
  return status === 'completed'
}

function isPayjoinFallback(status: PayjoinSessionStatus): boolean {
  return status === 'fallback'
}

export {
  isPayjoinFallback,
  isPayjoinSuccess,
  isPayjoinTerminal,
  PAYJOIN_TERMINAL_STATUSES
}
