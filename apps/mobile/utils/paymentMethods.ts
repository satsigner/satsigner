import type { PaymentMethod } from '@/components/SSPaymentMethodPicker'
import type { ArkAccount } from '@/types/models/Ark'

export function buildPaymentMethods(
  lightningConfig: { url: string } | null,
  mints: { url: string; name?: string }[],
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
  for (const mint of mints) {
    methods.push({
      detail: mint.name || mint.url,
      id: `ecash-${mint.url}`,
      label: 'ECash',
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
