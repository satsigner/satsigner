import * as StatusBar from 'expo-status-bar'
import { useEffect } from 'react'
import { Modal, Platform, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

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
  const insets = useSafeAreaInsets()

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return
    }
    if (!visible) {
      return StatusBar.setStatusBarBackgroundColor('transparent', false)
    }

    StatusBar.setStatusBarBackgroundColor('black', false)
  }, [visible])

  return (
    <Modal visible={visible} transparent={false}>
      <View
        style={{
          backgroundColor: Colors.black,
          flex: 1,
          paddingBottom: insets.bottom,
          paddingTop: insets.top
        }}
      >
        <SSMainLayout black style={{ paddingBottom: 20 }}>
          <ScrollView>
            <SSVStack gap="lg">
              <SSVStack>
                <SSText
                  center
                  color="muted"
                  size="sm"
                  style={{ minHeight: 40 }}
                  uppercase
                >
                  {title}
                </SSText>
              </SSVStack>
              <SSVStack style={{ paddingBottom: 16 }}>{children}</SSVStack>
            </SSVStack>
            {selectedText && selectedDescription && (
              <SSVStack gap="sm" style={{ paddingTop: 16 }}>
                {typeof selectedDescription === 'string' ? (
                  <SSText color="muted">{selectedDescription}</SSText>
                ) : (
                  selectedDescription
                )}
              </SSVStack>
            )}
          </ScrollView>
          <SSVStack gap="sm">
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
      </View>
    </Modal>
  )
}

export default SSSelectModal
