import { LinearGradient } from 'expo-linear-gradient'
import { Modal, StyleSheet, View } from 'react-native'

import SSMainLayout from '@/layouts/SSMainLayout'
import { i18n } from '@/locales'
import { Colors, Layout } from '@/styles'

import SSButton from './SSButton'

type SSGradientModalProps = {
  visible: boolean
  closeText?: string
  onClose(): void
  children: React.ReactNode
}

export default function SSGradientModal({
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
          colors={[Colors.gray[900], Colors.gray[800]]}
          start={{ x: 1, y: 1 }}
          end={{ x: 0, y: 0 }}
        >
          {children}
          <SSButton
            label={closeText || i18n.t('common.close')}
            style={{ borderTopRightRadius: 0, borderTopLeftRadius: 0 }}
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
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)'
  },
  gradientContainerBase: {
    alignItems: 'center',
    width: '100%',
    borderRadius: 3
  }
})
