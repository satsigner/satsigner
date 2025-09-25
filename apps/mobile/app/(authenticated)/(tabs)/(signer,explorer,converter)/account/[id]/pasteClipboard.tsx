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
import { useAccountsStore } from '@/store/accounts'
import { Colors, Layout } from '@/styles'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { bip21decode, isBip21, isBitcoinAddress } from '@/utils/bitcoin'
import { clearClipboard, getAllClipboardContent } from '@/utils/clipboard'
import { selectEfficientUtxos } from '@/utils/utxo'

export default function PasteClipboard() {
  const { id } = useLocalSearchParams<AccountSearchParams>()
  const router = useRouter()
  const [clipboardText, setClipboardText] = useState<string>('')

  const [clearTransaction, addOutput, addInput, setFeeRate] =
    useTransactionBuilderStore(
      useShallow((state) => [
        state.clearTransaction,
        state.addOutput,
        state.addInput,
        state.setFeeRate
      ])
    )

  const account = useAccountsStore(
    (state) => state.accounts.find((account) => account.id === id)!
  )

  function isPSBT(text: string): boolean {
    // PSBTs are base64 encoded and start with 'cHNidP8B' (base64 for 'psbt\xff')
    const trimmed = text.trim()
    // Check for PSBT magic bytes and ensure it's a reasonable length
    const isPSBTFormat = trimmed.startsWith('cHNidP8B') && trimmed.length > 50

    return isPSBTFormat
  }

  function isValidClipboardContent(text: string): boolean {
    if (!text || text.trim().length === 0) return false

    const trimmed = text.trim()

    // Check if it's a PSBT
    if (isPSBT(trimmed)) return true

    // Check if it's a Bitcoin address
    if (isBitcoinAddress(trimmed)) return true

    // Check if it's a BIP21 URI
    if (isBip21(trimmed)) return true

    // Check if it's a bitcoin: URI (remove prefix and check address)
    if (trimmed.toLowerCase().startsWith('bitcoin:')) {
      const addressPart = trimmed.substring(8)
      if (isBitcoinAddress(addressPart)) return true
    }

    return false
  }

  const hasToPaste = isValidClipboardContent(clipboardText)

  function handleAddress(address: string | void) {
    if (!address) return

    clearTransaction()

    const trimmedAddress = address.trim()

    if (isPSBT(trimmedAddress)) {
      router.navigate({
        pathname: '/account/[id]/signAndSend/signPSBT',
        params: { id, psbt: trimmedAddress }
      })
      return
    }

    let processedAddress = trimmedAddress
    let targetAmount = 0

    if (processedAddress.toLowerCase().startsWith('bitcoin:')) {
      processedAddress = processedAddress.substring(8)
    }

    if (isBitcoinAddress(processedAddress)) {
      addOutput({ amount: 1, label: 'Please update', to: processedAddress })
      targetAmount = 1
    } else if (isBip21(address)) {
      const decodedData = bip21decode(address)
      if (!decodedData || typeof decodedData === 'string') return
      targetAmount = (decodedData.options.amount || 0) * SATS_PER_BITCOIN || 1
      addOutput({
        amount: targetAmount,
        label: decodedData.options.label || 'Please update',
        to: decodedData.address
      })
    }

    // Auto-select UTXOs based on the target amount
    autoSelectUtxos(targetAmount)

    router.navigate({
      pathname: '/account/[id]/signAndSend/ioPreview',
      params: { id }
    })
  }

  function autoSelectUtxos(targetAmount: number) {
    if (!account || account.utxos.length === 0) return

    // Set a default fee rate if not set
    if (setFeeRate && typeof setFeeRate === 'function') {
      setFeeRate(1) // Default to 1 sat/vbyte
    }

    // If no target amount, select the highest value UTXO
    if (targetAmount === 0 || targetAmount === 1) {
      const highestUtxo = account.utxos.reduce((max, utxo) =>
        utxo.value > max.value ? utxo : max
      )
      addInput(highestUtxo)
      return
    }

    // Use efficient UTXO selection for the target amount
    const result = selectEfficientUtxos(
      account.utxos,
      targetAmount,
      1, // Default fee rate of 1 sat/vbyte
      {
        dustThreshold: 546,
        inputSize: 148,
        changeOutputSize: 34
      }
    )

    if (result.error) {
      // Fallback: select the highest value UTXO
      const highestUtxo = account.utxos.reduce((max, utxo) =>
        utxo.value > max.value ? utxo : max
      )
      addInput(highestUtxo)
    } else {
      // TODO: finish implementation of efficient selection algorithm
      // Add all selected UTXOs as inputs
      result.inputs.forEach((utxo) => addInput(utxo))
    }
  }

  useEffect(() => {
    ;(async () => {
      const text = await getAllClipboardContent()
      setClipboardText(text || '')
    })()

    const subscription = AppState.addEventListener(
      'change',
      async (nextAppState) => {
        if (nextAppState === 'active') {
          setTimeout(async () => {
            const text = await getAllClipboardContent()
            setClipboardText(text || '')
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
      handleAddress(clipboardText)
    }
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
              {hasToPaste
                ? t('common.clipboardHasContent')
                : t('common.clipboardEmpty')}
            </SSText>

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
                fontSize: 16,
                letterSpacing: 0.5,
                fontFamily: 'monospace',
                borderWidth: 1,
                padding: 10,
                borderColor:
                  clipboardText && !isValidClipboardContent(clipboardText)
                    ? Colors.error
                    : Colors.success,
                borderRadius: 5
              }}
              textAlignVertical="top"
            />
          </SSVStack>
          <SSVStack gap="sm">
            <SSButton
              variant={hasToPaste ? 'default' : 'secondary'}
              label={t('account.send')}
              disabled={!hasToPaste}
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
