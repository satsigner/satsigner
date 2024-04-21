import { Modal, ScrollView } from 'react-native'

import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'

import SSButton from './SSButton'
import SSText from './SSText'

type SSSelectModalProps = {
  visible: boolean
  title: string
  selectedText: string
  selectedDescription: string
  onSelect(): void
  onCancel(): void
  children: React.ReactNode
}

export default function SSSelectModal({
  visible,
  title,
  selectedText,
  selectedDescription,
  onSelect,
  onCancel,
  children
}: SSSelectModalProps) {
  return (
    <Modal visible={visible} transparent={false}>
      <SSMainLayout black>
        <ScrollView>
          <SSVStack>
            <SSText>{title}</SSText>
            <SSVStack>
              <SSText uppercase>{selectedText}</SSText>
              <SSText>{selectedDescription}</SSText>
            </SSVStack>
          </SSVStack>
          <SSVStack>{children}</SSVStack>
        </ScrollView>
        <SSVStack>
          <SSButton
            label={i18n.t('common.select')}
            variant="secondary"
            onPress={() => onSelect()}
          />
          <SSButton
            label={i18n.t('common.cancel')}
            variant="ghost"
            onPress={() => onCancel()}
          />
        </SSVStack>
      </SSMainLayout>
    </Modal>
  )
}
