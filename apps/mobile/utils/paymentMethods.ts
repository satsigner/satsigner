import { t } from '@/locales'
import type { ArkAccount } from '@/types/models/Ark'
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
