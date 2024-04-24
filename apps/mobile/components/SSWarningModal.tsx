import { Modal, ScrollView } from 'react-native'

import SSMainLayout from '@/layouts/SSMainLayout'
import { i18n } from '@/locales'

import SSButton from './SSButton'

type SSWarningModalProps = {
  visible: boolean
  onClose(): void
  children: React.ReactNode
}

export default function SSWarningModal({
  visible,
  onClose,
  children
}: SSWarningModalProps) {
  return (
    <Modal visible={visible} transparent={false}>
      <SSMainLayout black>
        <ScrollView>{children}</ScrollView>
        <SSButton
          label={i18n.t('common.acknowledge')}
          variant="secondary"
          onPress={() => onClose()}
        />
      </SSMainLayout>
    </Modal>
  )
}
