import { t } from '@/locales'
import type { LndCombinedTransaction } from '@/types/lndNodeDashboard'

const MS_MIN = 60_000
const MS_HOUR = 3_600_000
const MS_DAY = 86_400_000
const MS_YEAR = 365 * MS_DAY

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
  if (ms < MS_YEAR) {
    return t('lightning.node.txHistorical.daysAgo', {
      count: Math.max(1, Math.floor(ms / MS_DAY))
    })
  }
  return t('lightning.node.txHistorical.yearsAgo', {
    count: Math.max(1, Math.floor(ms / MS_YEAR))
  })
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
