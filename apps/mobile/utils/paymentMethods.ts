import { t } from '@/locales'
import type { ArkAccount } from '@/types/models/Ark'
import type { NostrZapPreferences } from '@/types/models/Nostr'
import type { PaymentMethod } from '@/types/models/PaymentMethod'

export function buildPaymentMethods(
  lightningConfig: { url: string; alias?: string } | null,
  ecashAccounts: { id: string; name: string }[] = [],
  ecashAllMints: Record<string, { balance: number }[]> = {},
  arkAccounts: ArkAccount[] = []
): PaymentMethod[] {
  const methods: PaymentMethod[] = []
  if (lightningConfig) {
    methods.push({
      detail: lightningConfig.url,
      id: 'lightning',
      label: lightningConfig.alias || t('paymentMethod.type.lightning'),
      type: 'lightning'
    })
  }
  for (const account of ecashAccounts) {
    const mints = ecashAllMints[account.id] ?? []
    const totalBalance = mints.reduce((sum, m) => sum + m.balance, 0)
    methods.push({
      accountId: account.id,
      balanceSats: totalBalance,
      id: `ecash-${account.id}`,
      label: account.name,
      type: 'ecash'
    })
  }
  for (const account of arkAccounts) {
    methods.push({
      accountId: account.id,
      detail: account.name,
      id: `ark-${account.id}`,
      label: t('paymentMethod.type.ark'),
      type: 'ark'
    })
  }
  return methods
}

/**
 * The wallet a zap can pay with without asking: the auto-approve wallet when
 * it still exists, otherwise the only wallet. Null means show the picker.
 */
export function getAutoPaymentMethod(
  methods: PaymentMethod[],
  zapPreferences?: NostrZapPreferences
): PaymentMethod | null {
  const autoApproveWalletId = zapPreferences?.autoApprove
    ? zapPreferences.autoApproveWalletId
    : undefined
  const autoWallet = autoApproveWalletId
    ? methods.find((method) => method.id === autoApproveWalletId)
    : undefined
  if (autoWallet) {
    return autoWallet
  }
  return methods.length === 1 ? (methods[0] ?? null) : null
}

type InvoicePayRoute =
  | { params: { invoice: string }; pathname: '/signer/lightning/pay' }
  | { params: { invoice: string }; pathname: '/signer/ecash/send' }
  | {
      params: { amountSats: string; id: string; invoice: string }
      pathname: '/signer/ark/account/[id]/pay-invoice'
    }

/** The screen that pays a bolt11 invoice with the given wallet. */
export function getInvoicePayRoute(
  method: PaymentMethod,
  invoice: string,
  amountSats: number
): InvoicePayRoute | null {
  if (method.type === 'lightning') {
    return { params: { invoice }, pathname: '/signer/lightning/pay' }
  }
  if (method.type === 'ecash') {
    return { params: { invoice }, pathname: '/signer/ecash/send' }
  }
  if (!method.accountId) {
    return null
  }
  return {
    params: { amountSats: String(amountSats), id: method.accountId, invoice },
    pathname: '/signer/ark/account/[id]/pay-invoice'
  }
}
