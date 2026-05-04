import { t } from '@/locales'
import type { LndCombinedTransaction } from '@/types/lndNodeDashboard'

const MS_MIN = 60_000
const MS_HOUR = 3_600_000
const MS_DAY = 86_400_000
const MS_MONTH = 30 * MS_DAY
const MS_YEAR = 365 * MS_DAY
const DAYS_SWITCH_TO_MONTHS = 90
const MONTHS_SWITCH_TO_YEARS = 14

/** Compact relative time for Lightning transaction list (e.g. `2h ago`). */
export function formatLightningTxTimeAgo(
  eventUnixSeconds: number,
  nowMs: number
): string {
  const ms = Math.max(0, nowMs - eventUnixSeconds * 1000)
  if (ms < MS_HOUR) {
    const minutes = ms < MS_MIN ? 1 : Math.max(1, Math.floor(ms / MS_MIN))
    return t('lightning.node.txHistorical.minutesAgo', { count: minutes })
  }
  if (ms < MS_DAY) {
    return t('lightning.node.txHistorical.hoursAgo', {
      count: Math.max(1, Math.floor(ms / MS_HOUR))
    })
  }
  if (ms < DAYS_SWITCH_TO_MONTHS * MS_DAY) {
    return t('lightning.node.txHistorical.daysAgo', {
      count: Math.max(1, Math.floor(ms / MS_DAY))
    })
  }
  if (ms < MONTHS_SWITCH_TO_YEARS * MS_MONTH) {
    return t('lightning.node.txHistorical.monthsAgo', {
      count: Math.max(1, Math.floor(ms / MS_MONTH))
    })
  }
  return t('lightning.node.txHistorical.yearsAgo', {
    count: Math.max(1, Math.floor(ms / MS_YEAR))
  })
}

const MS_30_DAYS = 30 * MS_DAY

export function txDateOptions(
  txTimestampSeconds: number,
  nowMs: number
): Intl.DateTimeFormatOptions {
  const age = nowMs - txTimestampSeconds * 1000
  return {
    day: 'numeric',
    hour: 'numeric',
    hour12: true,
    minute: 'numeric',
    month: 'short',
    ...(age < MS_30_DAYS ? { second: 'numeric' } : {}),
    year: 'numeric'
  }
}

export type TxStatusBadge =
  | 'pending'
  | 'expired'
  | 'canceled'
  | 'failed'
  | 'in_flight'

export function getTxStatusBadge(
  tx: LndCombinedTransaction,
  nowMs: number
): TxStatusBadge | null {
  if (tx.type === 'lightning_receive') {
    if (tx.status === 'canceled') {
      return 'canceled'
    }
    if (tx.status === 'open') {
      const isExpired =
        tx.expiry !== undefined && tx.timestamp + tx.expiry < nowMs / 1000
      return isExpired ? 'expired' : 'pending'
    }
  }
  if (tx.type === 'lightning_send') {
    const s = tx.status.toLowerCase()
    if (s === 'failed') {
      return 'failed'
    }
    if (s === 'in_flight') {
      return 'in_flight'
    }
  }
  if (tx.type === 'onchain' && tx.status === 'pending') {
    return 'pending'
  }
  return null
}

type TxDisplayInfo = {
  transactionType: 'send' | 'receive'
}

export function getTxDisplayInfo(
  tx: LndCombinedTransaction,
  isReceive: boolean
): TxDisplayInfo {
  if (tx.type === 'onchain') {
    return {
      transactionType: isReceive ? 'receive' : 'send'
    }
  }

  if (tx.type === 'lightning_send') {
    return {
      transactionType: 'send'
    }
  }

  if (tx.type === 'lightning_receive') {
    return {
      transactionType: 'receive'
    }
  }

  return {
    transactionType: 'send'
  }
}

/** Sat amount string for the transaction list fee column (Lightning sends only). */
export function getTxLightningSendFeeSatString(
  tx: LndCombinedTransaction,
  privacyMode: boolean
): string | null {
  if (privacyMode) {
    return null
  }
  if (tx.type === 'lightning_send' && tx.fee) {
    return String(tx.fee)
  }
  return null
}
