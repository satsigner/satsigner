import * as StatusBar from 'expo-status-bar'
import { useEffect } from 'react'
import { Modal, Platform, SafeAreaView, ScrollView } from 'react-native'

import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'

import SSButton from './SSButton'
import SSText from './SSText'

type SSSelectModalProps = {
  visible: boolean
  title: string
  selectedText?: string
  selectedDescription?: string | React.ReactNode
  onSelect(): void
  onCancel(): void
  children: React.ReactNode
}

function SSSelectModal({
  visible,
  title,
  selectedText,
  selectedDescription,
  onSelect,
  onCancel,
  children
}: SSSelectModalProps) {
  const splitSelectedText = selectedText?.split(' - ') || []

  useEffect(() => {
    if (Platform.OS !== 'android') return
    if (!visible)
      return StatusBar.setStatusBarBackgroundColor('transparent', false)

    StatusBar.setStatusBarBackgroundColor('black', false)
  }, [visible])

  return (
    <Modal visible={visible} transparent={false}>
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.black }}>
        <SSMainLayout black>
          <ScrollView>
            <SSVStack gap="lg">
              <SSVStack>
                <SSText color="muted" size="lg" style={{ alignSelf: 'center' }}>
                  {title}
                </SSText>
                {selectedText && selectedDescription && (
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
                )}
              </SSVStack>
              <SSVStack style={{ paddingBottom: 16 }}>{children}</SSVStack>
            </SSVStack>
          </ScrollView>
          <SSVStack>
            <SSButton
              label={t('common.select')}
              variant="secondary"
              onPress={() => onSelect()}
            />
            <SSButton
              label={t('common.cancel')}
              variant="ghost"
              onPress={() => onCancel()}
            />
          </SSVStack>
        </SSMainLayout>
      </SafeAreaView>
    </Modal>
  )
}

export default SSSelectModal
