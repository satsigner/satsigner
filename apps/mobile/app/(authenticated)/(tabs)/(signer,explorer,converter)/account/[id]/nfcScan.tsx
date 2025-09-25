import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState, useRef } from 'react'
import { AppState, StyleSheet, View, Platform } from 'react-native'
import { useShallow } from 'zustand/react/shallow'
import { useNFCReader } from '@/hooks/useNFCReader'

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
import { selectEfficientUtxos } from '@/utils/utxo'

export default function NFCScan() {
  const { id } = useLocalSearchParams<AccountSearchParams>()
  const router = useRouter()
  const [scannedText, setScannedText] = useState<string>('')
  const { isAvailable, isReading, readNFCTag, cancelNFCScan } = useNFCReader()

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

    console.log('NFC PSBT Check:', {
      text: trimmed.substring(0, 50) + (trimmed.length > 50 ? '...' : ''),
      length: trimmed.length,
      startsWith: trimmed.startsWith('cHNidP8B'),
      isPSBT: isPSBTFormat
    })

    return isPSBTFormat
  }

  function isValidScannedContent(text: string): boolean {
    if (!text || text.trim().length === 0) return false

    const trimmed = text.trim()

    console.log('NFC Content Validation:', {
      text: trimmed.substring(0, 50) + (trimmed.length > 50 ? '...' : ''),
      length: trimmed.length,
      isPSBT: isPSBT(trimmed),
      isBitcoinAddress: isBitcoinAddress(trimmed),
      isBip21: isBip21(trimmed)
    })

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

  const hasValidContent = isValidScannedContent(scannedText)

  console.log('NFC State:', { scannedText, hasValidContent })

  function handleAddress(address: string | void) {
    if (!address) return

    console.log('NFC Processing Address:', {
      address: address.substring(0, 50) + (address.length > 50 ? '...' : ''),
      length: address.length
    })

    clearTransaction()

    const trimmedAddress = address.trim()

    if (isPSBT(trimmedAddress)) {
      console.log('NFC Navigation: PSBT detected, navigating to signPSBT')
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
      console.log('NFC Processing: Removed bitcoin: prefix')
    }

    if (isBitcoinAddress(processedAddress)) {
      console.log('NFC Processing: Bitcoin address detected', {
        processedAddress,
        targetAmount: 1
      })
      addOutput({ amount: 1, label: 'Please update', to: processedAddress })
      targetAmount = 1
    } else if (isBip21(address)) {
      const decodedData = bip21decode(address)
      if (!decodedData || typeof decodedData === 'string') return
      targetAmount = (decodedData.options.amount || 0) * SATS_PER_BITCOIN || 1
      console.log('NFC Processing: BIP21 URI detected', {
        address: decodedData.address,
        amount: decodedData.options.amount,
        targetAmount,
        label: decodedData.options.label
      })
      addOutput({
        amount: targetAmount,
        label: decodedData.options.label || 'Please update',
        to: decodedData.address
      })
    }

    // Auto-select UTXOs based on the target amount
    console.log('NFC Auto-selecting UTXOs for target amount:', targetAmount)
    autoSelectUtxos(targetAmount)

    console.log('NFC Navigation: Navigating to ioPreview')
    router.navigate({
      pathname: '/account/[id]/signAndSend/ioPreview',
      params: { id }
    })
  }

  function autoSelectUtxos(targetAmount: number) {
    if (!account || account.utxos.length === 0) {
      console.log('NFC UTXO Selection: No account or UTXOs available')
      return
    }

    console.log('NFC UTXO Selection: Starting selection', {
      targetAmount,
      availableUtxos: account.utxos.length,
      totalUtxoValue: account.utxos.reduce((sum, utxo) => sum + utxo.value, 0)
    })

    // Set a default fee rate if not set
    if (setFeeRate && typeof setFeeRate === 'function') {
      setFeeRate(1) // Default to 1 sat/vbyte
      console.log('NFC UTXO Selection: Set default fee rate to 1 sat/vbyte')
    }

    // If no target amount, select the highest value UTXO
    if (targetAmount === 0 || targetAmount === 1) {
      const highestUtxo = account.utxos.reduce((max, utxo) =>
        utxo.value > max.value ? utxo : max
      )
      console.log('NFC UTXO Selection: Selected highest value UTXO', {
        txid: highestUtxo.txid,
        vout: highestUtxo.vout,
        value: highestUtxo.value
      })
      addInput(highestUtxo)
      return
    }

    // Use efficient UTXO selection for the target amount
    console.log('NFC UTXO Selection: Using efficient selection algorithm')
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
      console.log(
        'NFC UTXO Selection: Efficient selection failed, using fallback',
        { error: result.error }
      )
      // Fallback: select the highest value UTXO
      const highestUtxo = account.utxos.reduce((max, utxo) =>
        utxo.value > max.value ? utxo : max
      )
      console.log(
        'NFC UTXO Selection: Fallback - selected highest value UTXO',
        {
          txid: highestUtxo.txid,
          vout: highestUtxo.vout,
          value: highestUtxo.value
        }
      )
      addInput(highestUtxo)
    } else {
      console.log('NFC UTXO Selection: Efficient selection successful', {
        selectedInputs: result.inputs.length,
        totalInputValue: result.inputs.reduce(
          (sum, utxo) => sum + utxo.value,
          0
        ),
        fee: result.fee,
        change: result.change
      })
      // TODO: finish implementation of efficient selection algorithm
      // Add all selected UTXOs as inputs
      result.inputs.forEach((utxo) => {
        console.log('NFC UTXO Selection: Adding input', {
          txid: utxo.txid,
          vout: utxo.vout,
          value: utxo.value
        })
        addInput(utxo)
      })
    }
  }

  // NFC is now handled by the useNFCReader hook

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

      setScannedText(text)
    } catch (error) {
      console.error('NFC Scan: Error during NFC read', error)
    }
  }

  async function handleProcessScanned() {
    console.log('NFC Process: Processing scanned content', { scannedText })
    if (scannedText) {
      handleAddress(scannedText)
    }
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
                  : scannedText
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
              value={scannedText}
              onChangeText={setScannedText}
              placeholder={
                scannedText
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
                borderColor: scannedText
                  ? hasValidContent
                    ? Colors.success
                    : Colors.error
                  : Colors.gray[600],
                borderRadius: 5
              }}
              textAlignVertical="top"
            />
          </SSVStack>
          <SSVStack gap="sm">
            {hasValidContent ? (
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
