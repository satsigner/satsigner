import { LinearGradient } from 'expo-linear-gradient'
import { Modal, StyleSheet } from 'react-native'

import SSMainLayout from '@/layouts/SSMainLayout'
import { t } from '@/locales'
import { Colors } from '@/styles'

import SSButton from './SSButton'

interface SSGradientModalProps {
  visible: boolean
  closeText?: string
  onClose(): void
  children: React.ReactNode
}

function SSGradientModal({
  visible,
  closeText,
  onClose,
  children
}: SSGradientModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <SSMainLayout style={styles.containerBase}>
        <LinearGradient
          style={styles.gradientContainerBase}
          colors={[Colors.gray[950], Colors.gray[800]]}
          start={{ x: 1, y: 1 }}
          end={{ x: 0, y: 0 }}
        >
          {children}
          <SSButton
            label={closeText || t('common.close')}
            style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
            onPress={() => onClose()}
          />
        </LinearGradient>
      </SSMainLayout>
    </Modal>
  )
}

const styles = StyleSheet.create({
  containerBase: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center'
  },
  gradientContainerBase: {
    alignItems: 'center',
    borderRadius: 3,
    width: '100%'
  }
})

export default SSGradientModal
