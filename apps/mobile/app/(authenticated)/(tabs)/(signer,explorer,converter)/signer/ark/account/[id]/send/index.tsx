import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSPaste from '@/components/SSPaste'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useArkSendNavigation } from '@/hooks/useArkSendNavigation'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { type DetectedContent } from '@/utils/contentDetector'

const ARK_SEND_CONTEXT = 'ark' as const

export default function ArkSendEntryPage() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { handleContentReady, processDestination } = useArkSendNavigation(id)

  const [destination, setDestination] = useState('')
  const [cameraVisible, setCameraVisible] = useState(false)
  const [pasteVisible, setPasteVisible] = useState(false)
  const [isValidating, setIsValidating] = useState(false)

  async function handleScanned(content: DetectedContent) {
    setCameraVisible(false)
    setPasteVisible(false)
    await handleContentReady(content)
  }

  async function handleContinue() {
    setIsValidating(true)
    try {
      await processDestination(destination)
    } finally {
      setIsValidating(false)
    }
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{t('ark.send.title')}</SSText>
        }}
      />
      <ScrollView>
        <SSVStack gap="lg" style={styles.container}>
          <SSVStack gap="xs">
            <SSText color="muted" size="xs" uppercase>
              {t('ark.send.destination')}
            </SSText>
            <SSTextInput
              align="left"
              value={destination}
              onChangeText={setDestination}
              placeholder={t('ark.send.destinationPlaceholder')}
              multiline
              numberOfLines={4}
              style={styles.input}
            />
          </SSVStack>
          <SSHStack gap="sm">
            <SSButton
              label={t('ark.send.paste')}
              onPress={() => setPasteVisible(true)}
              variant="subtle"
              style={styles.actionButton}
            />
            <SSButton
              label={t('ark.send.scan')}
              onPress={() => setCameraVisible(true)}
              variant="subtle"
              style={styles.actionButton}
            />
          </SSHStack>
          <View style={styles.continueWrapper}>
            <SSButton
              label={t('common.continue')}
              onPress={handleContinue}
              variant="secondary"
              disabled={destination.trim().length === 0 || isValidating}
              loading={isValidating}
            />
            <SSButton
              label={t('common.cancel')}
              onPress={() => router.back()}
              variant="ghost"
            />
          </View>
        </SSVStack>
      </ScrollView>
      <SSCameraModal
        visible={cameraVisible}
        onClose={() => setCameraVisible(false)}
        onContentScanned={handleScanned}
        context={ARK_SEND_CONTEXT}
        title={t('ark.send.scanTitle')}
      />
      <SSPaste
        visible={pasteVisible}
        onClose={() => setPasteVisible(false)}
        onContentPasted={handleScanned}
        context={ARK_SEND_CONTEXT}
      />
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  actionButton: {
    flex: 1
  },
  container: {
    paddingBottom: 60,
    paddingTop: 20
  },
  continueWrapper: {
    gap: 12,
    marginTop: 16
  },
  input: {
    height: 120,
    textAlignVertical: 'top'
  }
})
