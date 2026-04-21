import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'

export type PaymentMethod = {
  id: string
  label: string
  type: 'lightning' | 'ecash' | 'ark'
  detail?: string
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
              Pay {amountSats} sats with:
            </SSText>
            {methods.map((method) => (
              <TouchableOpacity
                key={method.id}
                style={styles.methodRow}
                onPress={() => onSelect(method)}
                activeOpacity={0.6}
              >
                <SSVStack gap="xxs">
                  <SSText size="md" weight="medium">
                    {method.label}
                  </SSText>
                  {method.detail && (
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
  methodRow: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 3,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14
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
