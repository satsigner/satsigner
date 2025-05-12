import { Modal, StyleSheet } from 'react-native'

import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

import SSButton, { type SSButtonProps } from './SSButton'

type SSModalProps = {
  visible: boolean
  fullOpacity?: boolean
  closeButtonVariant?: SSButtonProps['variant']
  label?: string
  onClose(): void
  children: React.ReactNode
}

function SSModal({
  visible,
  fullOpacity = false,
  closeButtonVariant = 'ghost',
  label = t('common.cancel'),
  onClose,
  children
}: SSModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <SSMainLayout
        style={fullOpacity ? styles.containerFullOpacity : styles.containerBase}
      >
        <SSVStack justifyBetween itemsCenter style={styles.innerContainer}>
          {children}
          <SSButton
            label={label}
            variant={closeButtonVariant}
            onPress={onClose}
          />
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
  },
  innerContainer: {
    paddingVertical: 16
  }
})

export default SSModal
