import type { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { toast } from 'sonner-native'

import { t } from '@/locales'
import { useArkStore } from '@/store/ark'
import { useEcashStore } from '@/store/ecash'
import { useLightningStore } from '@/store/lightning'
import type { PaymentMethod } from '@/types/models/PaymentMethod'
import { isChatInvoiceExpired } from '@/utils/chatPaymentRequests'
import type { ChatInvoice } from '@/utils/chatPaymentRequests'
import { setClipboard } from '@/utils/clipboard'
import {
  buildPaymentMethods,
  getInvoicePaymentMethods,
  getInvoicePayRoute
} from '@/utils/paymentMethods'

/**
 * Paying an invoice found in a chat message: picks the wallet (the only one,
 * or the picker sheet) and opens that wallet's pay screen with the invoice.
 * Nothing is paid here; the pay screen asks for confirmation.
 */
function useChatInvoicePay() {
  const router = useRouter()
  const lightningConfig = useLightningStore((state) => state.config)
  const lightningNodeAlias = useLightningStore(
    (state) => state.status.nodeInfo?.alias
  )
  const ecashAccounts = useEcashStore((state) => state.accounts)
  const ecashAllMints = useEcashStore((state) => state.mints)
  const setEcashActiveAccountId = useEcashStore(
    (state) => state.setActiveAccountId
  )
  const arkAccounts = useArkStore((state) => state.accounts)

  const paymentSheetRef = useRef<BottomSheetMethods>(null)
  const [pending, setPending] = useState<ChatInvoice | null>(null)

  const paymentMethods = buildPaymentMethods(
    lightningConfig ? { ...lightningConfig, alias: lightningNodeAlias } : null,
    ecashAccounts,
    ecashAllMints,
    arkAccounts
  )

  function openPayScreen(method: PaymentMethod, invoice: ChatInvoice) {
    const route = getInvoicePayRoute(
      method,
      invoice.invoice,
      invoice.amountSats
    )
    if (!route) {
      return
    }
    if (method.type === 'ecash' && method.accountId) {
      setEcashActiveAccountId(method.accountId)
    }
    router.navigate(route)
  }

  function canPay(invoice: ChatInvoice) {
    return getInvoicePaymentMethods(paymentMethods, invoice).length > 0
  }

  function pay(invoice: ChatInvoice) {
    const methods = getInvoicePaymentMethods(paymentMethods, invoice)
    const [onlyMethod] = methods
    if (methods.length === 1 && onlyMethod) {
      openPayScreen(onlyMethod, invoice)
      return
    }
    setPending(invoice)
    paymentSheetRef.current?.expand()
  }

  function selectMethod(method: PaymentMethod) {
    paymentSheetRef.current?.close()
    setPending(null)
    if (!pending) {
      return
    }
    if (isChatInvoiceExpired(pending)) {
      toast.error(t('nostrIdentity.chat.invoice.expiredBeforePay'))
      return
    }
    openPayScreen(method, pending)
  }

  async function copy(invoice: string) {
    const copied = await setClipboard(invoice)
    if (copied) {
      toast.success(t('common.copiedToClipboard'))
      return
    }
    toast.error(t('common.copyFailed'))
  }

  return {
    canPay,
    copy,
    pay,
    paymentMethods: pending
      ? getInvoicePaymentMethods(paymentMethods, pending)
      : [],
    paymentSheetRef,
    pendingAmountSats: pending?.amountSats ?? 0,
    selectMethod
  }
}

export { useChatInvoicePay }
