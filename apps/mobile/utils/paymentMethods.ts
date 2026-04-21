import type { PaymentMethod } from '@/components/SSPaymentMethodPicker'

export function buildPaymentMethods(
  lightningConfig: { url: string } | null,
  mints: { url: string; name?: string }[]
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
  return methods
}
