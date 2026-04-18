import { t } from '@/locales'
import { Colors } from '@/styles'
import type { LndCombinedTransaction } from '@/types/lndNodeDashboard'

type TxDisplayInfo = {
  transactionType: 'send' | 'receive'
  typeColor: string
  typeLabel: string
}

export function getTxDisplayInfo(
  tx: LndCombinedTransaction,
  isReceive: boolean
): TxDisplayInfo {
  if (tx.type === 'onchain') {
    return {
      transactionType: isReceive ? 'receive' : 'send',
      typeColor: Colors.white,
      typeLabel: t('lightning.node.onchainTab')
    }
  }

  if (tx.type === 'lightning_send') {
    return {
      transactionType: 'send',
      typeColor: Colors.mainRed,
      typeLabel: t('lightning.node.defaultPaymentMemo')
    }
  }

  if (tx.type === 'lightning_receive') {
    const color =
      tx.status === 'settled'
        ? Colors.mainGreen
        : tx.status === 'open'
          ? Colors.warning
          : Colors.white
    return {
      transactionType: 'receive',
      typeColor: color,
      typeLabel: t('lightning.node.defaultInvoiceMemo')
    }
  }

  return {
    transactionType: 'send',
    typeColor: Colors.white,
    typeLabel: ''
  }
}

export function getTxStatusText(
  tx: LndCombinedTransaction,
  privacyMode: boolean
): string {
  if (tx.type === 'lightning_receive') {
    switch (tx.status) {
      case 'settled':
        return t('lightning.node.txStatusSettled')
      case 'canceled':
        return t('lightning.node.txStatusCanceled')
      case 'open':
        return t('lightning.node.txStatusOpen')
      default:
        return `• ${tx.status}`
    }
  }

  if (tx.type === 'onchain') {
    const base =
      tx.status === 'confirmed'
        ? t('lightning.node.txStatusConfirmed')
        : t('lightning.node.txStatusPending')
    if (tx.num_confirmations && !privacyMode) {
      return `${base} • ${t('lightning.node.txConfirmations', { count: tx.num_confirmations })}`
    }
    return base
  }

  if (tx.type === 'lightning_send') {
    const base =
      tx.status === 'SUCCEEDED'
        ? t('lightning.node.txStatusSent')
        : t('lightning.node.txStatusFailed')
    if (tx.fee && !privacyMode) {
      return `${base} • ${t('lightning.node.txFee', { fee: String(tx.fee) })}`
    }
    return base
  }

  return ''
}
