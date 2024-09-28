import { Modal, StyleSheet } from 'react-native'

import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'

import SSButton from './SSButton'

type SSModalProps = {
  visible: boolean
  onClose(): void
  children: React.ReactNode
}

export default function SSModal({ visible, onClose, children }: SSModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <SSMainLayout style={styles.containerBase}>
        <SSVStack itemsCenter justifyBetween style={{ paddingVertical: 16 }}>
          {children}
          <SSButton
            label={i18n.t('common.cancel')}
            variant="ghost"
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
  }
})
