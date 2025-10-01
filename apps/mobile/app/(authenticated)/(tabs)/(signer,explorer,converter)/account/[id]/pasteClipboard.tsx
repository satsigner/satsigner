import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { AppState, StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors, Layout } from '@/styles'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { getAllClipboardContent } from '@/utils/clipboard'
import { useBitcoinContentInput } from '@/hooks/useBitcoinContentInput'

export default function PasteClipboard() {
  const { id } = useLocalSearchParams<AccountSearchParams>()
  const router = useRouter()
  const { content, setContent, isValidContent, handleProcessContent } =
    useBitcoinContentInput(id)

  useEffect(() => {
    ;(async () => {
      const text = await getAllClipboardContent()
      setContent(text || '')
    })()

    const subscription = AppState.addEventListener(
      'change',
      async (nextAppState) => {
        if (nextAppState === 'active') {
          setTimeout(async () => {
            const text = await getAllClipboardContent()
            setContent(text || '')
          }, 1)
        }
      }
    )

    return () => {
      subscription.remove()
    }
  }, [setContent])

  async function handlePaste() {
    handleProcessContent(router.navigate)
  }

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('common.pasteFromClipboard')}</SSText>
          ),

          headerRight: undefined
        }}
      />
      <SSMainLayout
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          top: 0,
          paddingTop: 100,
          paddingBottom: Layout.mainContainer.paddingBottom
        }}
      >
        <SSVStack justifyBetween style={{ height: '100%' }}>
          <SSVStack itemsCenter>
            <SSText
              center
              style={{ maxWidth: 300, marginBottom: 20, lineHeight: 22 }}
            >
              {isValidContent
                ? t('common.clipboardHasContent')
                : t('common.clipboardEmpty')}
            </SSText>

            <SSTextInput
              value={content}
              onChangeText={setContent}
              placeholder={t('common.pasteFromClipboard')}
              multiline
              numberOfLines={40}
              style={{
                minHeight: 100,
                marginBottom: 20,
                textAlign: 'left',
                fontSize: 16,
                letterSpacing: 0.5,
                fontFamily: 'monospace',
                borderWidth: 1,
                padding: 10,
                borderColor:
                  content && !isValidContent ? Colors.error : Colors.success,
                borderRadius: 5
              }}
              textAlignVertical="top"
            />
          </SSVStack>
          <SSVStack gap="sm">
            <SSButton
              variant={isValidContent ? 'default' : 'secondary'}
              label={t('account.send')}
              disabled={!isValidContent}
              onPress={handlePaste}
            />
            <SSButton
              variant="ghost"
              label={t('common.cancel')}
              onPress={() => router.back()}
            />
          </SSVStack>
        </SSVStack>
      </SSMainLayout>
    </View>
  )
}
