import { Modal, StyleSheet } from 'react-native'

import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

import SSButton from './SSButton'

type SSModalProps = {
  visible: boolean
  fullOpacity?: boolean
  variant?:
    | 'secondary'
    | 'ghost'
    | 'subtle'
    | 'gradient'
    | 'default'
    | 'outline'
    | 'danger'
  label?: string
  onClose(): void
  children: React.ReactNode
}

function SSModal({
  visible,
  fullOpacity = false,
  variant = 'ghost',
  label = t('common.cancel'),
  onClose,
  children
}: SSModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <SSMainLayout
        style={fullOpacity ? styles.containerFullOpacity : styles.containerBase}
      >
        <SSVStack itemsCenter justifyBetween style={{ paddingVertical: 16 }}>
          {children}
          <SSButton label={label} variant={variant} onPress={onClose} />
        </SSVStack>
      </SSMainLayout>
    </Modal>
  )
}

const styles = StyleSheet.create({
  containerBase: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)'
  },
  containerFullOpacity: {
    backgroundColor: 'rgba(0, 0, 0, 1)'
  }
})

export default SSModal
