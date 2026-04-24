import { useQueryClient } from '@tanstack/react-query'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSPaste from '@/components/SSPaste'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import {
  type ArkDestinationDraft,
  parseArkDestination
} from '@/utils/arkDestination'
import { type DetectedContent } from '@/utils/contentDetector'

const ARK_SEND_CONTEXT = 'ark' as const

export default function ArkSendEntryPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [destination, setDestination] = useState('')
  const [cameraVisible, setCameraVisible] = useState(false)
  const [pasteVisible, setPasteVisible] = useState(false)
  const [isValidating, setIsValidating] = useState(false)

  function goToConfirm(cleanedDestination: string, draft: ArkDestinationDraft) {
    queryClient.setQueryData<ArkDestinationDraft>(
      ['ark', 'send', 'parse', cleanedDestination],
      draft
    )
    router.navigate({
      params: { destination: cleanedDestination, id },
      pathname: '/signer/ark/account/[id]/send/confirm'
    })
  }

  async function handleContentReady(content: DetectedContent) {
    setCameraVisible(false)
    setPasteVisible(false)

    const raw = content.raw ?? content.cleaned
    const parsed = await parseArkDestination(raw)
    if (!parsed.ok) {
      toast.error(t('ark.send.error.invalidDestination'))
      return
    }
    goToConfirm(raw.trim(), parsed.draft)
  }

  async function handleContinue() {
    const trimmed = destination.trim()
    if (!trimmed) {
      return
    }
    setIsValidating(true)
    try {
      const parsed = await parseArkDestination(trimmed)
      if (!parsed.ok) {
        toast.error(t('ark.send.error.invalidDestination'))
        return
      }
      goToConfirm(trimmed, parsed.draft)
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
        onContentScanned={handleContentReady}
        context={ARK_SEND_CONTEXT}
        title={t('ark.send.scanTitle')}
      />
      <SSPaste
        visible={pasteVisible}
        onClose={() => setPasteVisible(false)}
        onContentPasted={handleContentReady}
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
