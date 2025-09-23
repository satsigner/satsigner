import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { AppState, StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { SATS_PER_BITCOIN } from '@/constants/btc'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors, Layout } from '@/styles'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { bip21decode, isBip21, isBitcoinAddress } from '@/utils/bitcoin'
import { clearClipboard, getAllClipboardContent } from '@/utils/clipboard'

export default function PasteClipboard() {
  const { id } = useLocalSearchParams<AccountSearchParams>()
  const router = useRouter()
  const [hasToPaste, setHasToPaste] = useState(false)
  const [clipboardText, setClipboardText] = useState<string>('')

  const [clearTransaction, addOutput] = useTransactionBuilderStore(
    useShallow((state) => [state.clearTransaction, state.addOutput])
  )

  function isPSBT(text: string): boolean {
    // PSBTs are base64 encoded and start with 'cHNidP8B' (base64 for 'psbt\xff')
    const trimmed = text.trim()
    // Check for PSBT magic bytes and ensure it's a reasonable length
    const isPSBTFormat = trimmed.startsWith('cHNidP8B') && trimmed.length > 50

    // Debug logging (remove in production)
    if (trimmed.length > 0) {
      console.log('Checking PSBT:', {
        startsWith: trimmed.startsWith('cHNidP8B'),
        length: trimmed.length,
        firstChars: trimmed.substring(0, 10),
        isPSBT: isPSBTFormat
      })
    }

    return isPSBTFormat
  }

  function handleAddress(address: string | void) {
    if (!address) return

    clearTransaction()

    const trimmedAddress = address.trim()

    // Check if it's a PSBT
    if (isPSBT(trimmedAddress)) {
      // Handle PSBT - navigate to PSBT signing flow
      router.navigate({
        pathname: '/account/[id]/signAndSend/signPSBT',
        params: { id, psbt: trimmedAddress }
      })
      return
    }

    // Handle various Bitcoin address formats
    let processedAddress = trimmedAddress

    // Remove bitcoin: prefix if present
    if (processedAddress.toLowerCase().startsWith('bitcoin:')) {
      processedAddress = processedAddress.substring(8)
    }

    if (isBitcoinAddress(processedAddress)) {
      addOutput({ amount: 1, label: 'Please update', to: processedAddress })
    } else if (isBip21(address)) {
      const decodedData = bip21decode(address)
      if (!decodedData || typeof decodedData === 'string') return
      addOutput({
        amount: (decodedData.options.amount || 0) * SATS_PER_BITCOIN || 1,
        label: decodedData.options.label || 'Please update',
        to: decodedData.address
      })
    }

    router.navigate({
      pathname: '/account/[id]/signAndSend/selectUtxoList',
      params: { id }
    })
  }

  useEffect(() => {
    ;(async () => {
      const text = await getAllClipboardContent()
      setClipboardText(text || '')
      setHasToPaste(!!text)
    })()

    const subscription = AppState.addEventListener(
      'change',
      async (nextAppState) => {
        if (nextAppState === 'active') {
          setTimeout(async () => {
            const text = await getAllClipboardContent()
            setClipboardText(text || '')
            setHasToPaste(!!text)
          }, 1)
        }
      }
    )

    return () => {
      subscription.remove()
    }
  }, [])

  async function handlePaste() {
    if (clipboardText) {
      await clearClipboard()
      handleAddress(clipboardText)
    }
    setHasToPaste(false)
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
            <SSText center style={{ maxWidth: 300, marginBottom: 20 }}>
              {hasToPaste
                ? t('common.clipboardHasContent')
                : t('common.clipboardEmpty')}
            </SSText>
            {hasToPaste && (
              <SSTextInput
                value={clipboardText}
                onChangeText={setClipboardText}
                placeholder={t('common.pasteFromClipboard')}
                multiline
                numberOfLines={40}
                style={{
                  minHeight: 100,
                  marginBottom: 20,
                  textAlign: 'left',
                  fontSize: 12
                }}
                textAlignVertical="top"
              />
            )}
          </SSVStack>
          <SSButton
            variant={hasToPaste ? 'default' : 'secondary'}
            label={t('common.paste')}
            disabled={!hasToPaste}
            onPress={handlePaste}
          />
        </SSVStack>
      </SSMainLayout>
    </View>
  )
}
