import type { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { type ForwardedRef, forwardRef } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'

import SSBottomSheet from '@/components/SSBottomSheet'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { Colors } from '@/styles'
import { formatFiatPrice } from '@/utils/format'

export type PaymentMethod = {
  id: string
  label: string
  type: 'lightning' | 'ecash' | 'ark'
  detail?: string
  accountId?: string
  balanceSats?: number
}

const TYPE_LABEL: Record<PaymentMethod['type'], string> = {
  ark: 'Ark',
  ecash: 'ECash',
  lightning: 'Lightning'
}

type SSPaymentMethodPickerProps = {
  onSelect: (method: PaymentMethod) => void
  methods: PaymentMethod[]
  amountSats: number
}

function SSPaymentMethodPicker(
  { onSelect, methods, amountSats }: SSPaymentMethodPickerProps,
  ref: ForwardedRef<BottomSheetMethods>
) {
  const btcPrice = usePriceStore((state) => state.btcPrice)
  const fiatCurrency = usePriceStore((state) => state.fiatCurrency)

  return (
    <SSBottomSheet
      ref={ref}
      title={`Pay ${amountSats.toLocaleString()} sats`}
    >
      <SSVStack gap="md" style={styles.content}>
        {methods.map((method) => (
          <TouchableOpacity
            key={method.id}
            style={styles.methodRow}
            onPress={() => onSelect(method)}
            activeOpacity={0.6}
          >
            <SSVStack gap="xxs">
              <SSHStack gap="sm" style={styles.methodRowHeader}>
                <SSText size="md" weight="medium" style={styles.methodLabel}>
                  {method.label}
                </SSText>
                <View style={styles.typeBadge}>
                  <SSText size="xxs" color="muted">
                    {TYPE_LABEL[method.type]}
                  </SSText>
                </View>
              </SSHStack>
              {method.balanceSats !== undefined && (
                <SSText size="xs" color="muted">
                  {method.balanceSats.toLocaleString()} sats
                  {btcPrice > 0
                    ? ` · ${fiatCurrency} ${formatFiatPrice(method.balanceSats, btcPrice)}`
                    : ''}
                </SSText>
              )}
              {method.detail && method.balanceSats === undefined && (
                <SSText size="xs" color="muted">
                  {method.detail}
                </SSText>
              )}
            </SSVStack>
          </TouchableOpacity>
        ))}
        <SSButton
          label={t('common.cancel')}
          variant="ghost"
          onPress={() => {
            if (typeof ref === 'object' && ref !== null) {
              ref.current?.close()
            }
          }}
        />
      </SSVStack>
    </SSBottomSheet>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 16
  },
  methodLabel: {
    flex: 1
  },
  methodRow: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 3,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  methodRowHeader: {
    alignItems: 'center'
  },
  typeBadge: {
    backgroundColor: Colors.gray[800],
    borderColor: Colors.gray[700],
    borderRadius: 3,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2
  }
})

export default forwardRef(SSPaymentMethodPicker)
