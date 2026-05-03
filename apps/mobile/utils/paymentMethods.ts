import type { PaymentMethod } from '@/components/SSPaymentMethodPicker'
import type { ArkAccount } from '@/types/models/Ark'

type EcashAccountWithMints = {
  id: string
  name: string
  mints: { balance: number }[]
}

export function buildPaymentMethods(
  lightningConfig: { url: string } | null,
  ecashAccounts: EcashAccountWithMints[] = [],
  arkAccounts: ArkAccount[] = []
): PaymentMethod[] {
  const methods: PaymentMethod[] = []
  if (lightningConfig) {
    methods.push({
      detail: lightningConfig.url,
      id: 'lightning',
      label: 'Lightning',
      type: 'lightning'
    })
  }
  for (const account of ecashAccounts) {
    const totalBalance = account.mints.reduce((sum, m) => sum + m.balance, 0)
    methods.push({
      accountId: account.id,
      detail: `${totalBalance.toLocaleString()} sats`,
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
      label: 'Ark',
      type: 'ark'
    })
  }
  return methods
}
