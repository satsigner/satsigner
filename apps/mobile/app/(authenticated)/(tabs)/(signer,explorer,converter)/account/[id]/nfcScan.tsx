import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors, Layout } from '@/styles'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { useNFCReader } from '@/hooks/useNFCReader'
import { useBitcoinContentInput } from '@/hooks/useBitcoinContentInput'

export default function NFCScan() {
  const { id } = useLocalSearchParams<AccountSearchParams>()
  const router = useRouter()
  const { content, setContent, isValidContent, handleProcessContent } =
    useBitcoinContentInput(id)
  const { isAvailable, isReading, readNFCTag, cancelNFCScan } = useNFCReader()

  console.log('NFC State:', { content, isValidContent })

  async function handleNFCRead() {
    if (isReading) {
      await cancelNFCScan()
      return
    }

    try {
      console.log('NFC Scan: Starting NFC read')
      const nfcData = await readNFCTag()

      if (!nfcData) {
        console.log('NFC Scan: No data received')
        return
      }

      if (!nfcData.text) {
        console.log('NFC Scan: No text data in NFC tag')
        return
      }

      const text = nfcData.text
        .trim()
        .replace(/[^\S\n]+/g, '') // Remove all whitespace except newlines
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces and other invisible characters
        .replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g, '') // Remove control characters except \n
        .normalize('NFKC') // Normalize unicode characters

      console.log('NFC Data Received:', {
        data: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        length: text.length
      })

      setContent(text)
    } catch (error) {
      console.error('NFC Scan: Error during NFC read', error)
    }
  }

  async function handleProcessScanned() {
    console.log('NFC Process: Processing scanned content', { content })
    handleProcessContent(router.navigate)
  }

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{t('camera.scanNFC')}</SSText>,
          headerBackground: () => (
            <LinearGradient
              style={{
                height: '100%',
                justifyContent: 'center',
                alignItems: 'center'
              }}
              colors={[Colors.gray[950], Colors.gray[800]]}
              start={{ x: 0.86, y: 1.0 }}
              end={{ x: 0.14, y: 1 }}
            />
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
            <SSText center style={{ maxWidth: 300, marginBottom: 20 }}>
              {isAvailable
                ? isReading
                  ? t('camera.scanningNFC')
                  : content
                    ? t('camera.nfcScannedContent')
                    : t('camera.nfcInstructions')
                : t('camera.nfcNotSupported')}
            </SSText>
            {isReading && (
              <SSText
                center
                style={{
                  maxWidth: 300,
                  fontSize: 12,
                  color: Colors.gray[400],
                  marginBottom: 20
                }}
              >
                {t('camera.bringNFCClose')}
              </SSText>
            )}
            <SSTextInput
              value={content}
              onChangeText={setContent}
              placeholder={
                content
                  ? t('camera.nfcScannedContent')
                  : 'Enter Bitcoin address, PSBT, or BIP21 URI manually'
              }
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
                borderColor: content
                  ? isValidContent
                    ? Colors.success
                    : Colors.error
                  : Colors.gray[600],
                borderRadius: 5
              }}
              textAlignVertical="top"
            />
          </SSVStack>
          <SSVStack gap="sm">
            {isValidContent ? (
              <>
                <SSButton
                  variant="default"
                  label={t('account.send')}
                  onPress={handleProcessScanned}
                />
                <SSButton
                  variant="ghost"
                  label={t('common.cancel')}
                  onPress={() => router.back()}
                />
              </>
            ) : (
              <>
                <SSButton
                  variant={isReading ? 'secondary' : 'default'}
                  label={
                    isReading ? t('common.cancel') : t('camera.startNFCScan')
                  }
                  disabled={!isAvailable}
                  onPress={handleNFCRead}
                />
                <SSButton
                  variant="ghost"
                  label={t('common.cancel')}
                  onPress={() => router.back()}
                />
              </>
            )}
          </SSVStack>
        </SSVStack>
      </SSMainLayout>
    </View>
  )
}
