import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
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
  visible: boolean
  onClose: () => void
  onSelect: (method: PaymentMethod) => void
  methods: PaymentMethod[]
  amountSats: number
}

function SSPaymentMethodPicker({
  visible,
  onClose,
  onSelect,
  methods,
  amountSats
}: SSPaymentMethodPickerProps) {
  const btcPrice = usePriceStore((state) => state.btcPrice)
  const fiatCurrency = usePriceStore((state) => state.fiatCurrency)

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <SSVStack gap="md">
            <SSText size="lg" weight="medium" center>
              Pay {amountSats.toLocaleString()} sats with:
            </SSText>
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
            <SSButton label="Cancel" variant="ghost" onPress={onClose} />
          </SSVStack>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
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
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    flex: 1,
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: Colors.gray[950],
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 20
  }
})

export default SSPaymentMethodPicker
