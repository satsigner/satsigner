import * as StatusBar from 'expo-status-bar'
import { useEffect, useMemo } from 'react'
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
  selectedDescription: string | React.ReactNode
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
  const splitSelectedText = selectedText.split(' - ')

  useEffect(() => {
    if (!visible)
      return StatusBar.setStatusBarBackgroundColor('transparent', false)

    StatusBar.setStatusBarBackgroundColor('black', false)
  }, [visible])

  return (
    <Modal visible={visible} transparent={false}>
      <SSMainLayout black>
        <ScrollView>
          <SSVStack gap="lg">
            <SSVStack>
              <SSText color="muted" size="lg" style={{ alignSelf: 'center' }}>
                {title}
              </SSText>
              <SSVStack gap="sm">
                <SSText uppercase>
                  {splitSelectedText.length > 1 ? (
                    <>
                      <SSText weight="bold">{splitSelectedText[0]}</SSText>
                      {' - '}
                      {splitSelectedText[1]}
                    </>
                  ) : (
                    selectedText
                  )}
                </SSText>
                {typeof selectedDescription === 'string' ? (
                  <SSText color="muted">{selectedDescription}</SSText>
                ) : (
                  selectedDescription
                )}
              </SSVStack>
            </SSVStack>
            <SSVStack>{children}</SSVStack>
          </SSVStack>
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
