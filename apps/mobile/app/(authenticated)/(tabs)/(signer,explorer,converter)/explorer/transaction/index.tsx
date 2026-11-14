import { useMutation } from '@tanstack/react-query'
import { useCameraPermissions } from 'expo-camera'
import * as Clipboard from 'expo-clipboard'
import { Stack, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { broadcastRawTransaction } from '@/api/broadcast'
import { SSIconChevronRight } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSNFCModal from '@/components/SSNFCModal'
import SSPressable from '@/components/SSPressable'
import SSQrScanner from '@/components/SSQrScanner'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { EXPLORER_EXAMPLE_TRANSACTIONS } from '@/constants/explorerExamples'
import { useNFCReader } from '@/hooks/useNFCReader'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import { detectTransactionSearchInput } from '@/utils/bitcoinContent'
import { formatTxId } from '@/utils/format'

const tn = _tn('explorer.transaction')

function ExampleIoCount({
  count,
  kind
}: {
  count: number
  kind: 'in' | 'out'
}) {
  const word =
    kind === 'in'
      ? count === 1
        ? t('transaction.input.singular')
        : t('transaction.input.plural')
      : count === 1
        ? t('transaction.output.singular')
        : t('transaction.output.plural')

  return (
    <SSHStack gap="xs" style={styles.exampleIoRow}>
      <SSText size="xs">{count}</SSText>
      <SSText size="xs" color="muted">
        {word.toLowerCase()}
      </SSText>
    </SSHStack>
  )
}

export default function ExplorerTransaction() {
  const router = useRouter()
  const [inputTxid, setInputTxid] = useState('')
  const [scanOpen, setScanOpen] = useState(false)
  const scannedRef = useRef(false)
  const [nfcOpen, setNfcOpen] = useState(false)
  const [permission, requestPermission] = useCameraPermissions()
  const { isAvailable: nfcAvailable } = useNFCReader()

  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]
  const showExamples = selectedNetwork === 'bitcoin'

  const inputType = detectTransactionSearchInput(inputTxid)

  const { mutate: broadcast, isPending: isBroadcasting } = useMutation({
    mutationFn: (hex: string) => broadcastRawTransaction(hex, server),
    onError: () => toast.error(tn('broadcastError')),
    onSuccess: (txid) => {
      toast.success(tn('broadcastSuccess'))
      router.push(`/explorer/transaction/${txid}`)
    }
  })

  function navigate(txid: string) {
    router.push(`/explorer/transaction/${txid}`)
  }

  function handleInputContent(text: string) {
    const trimmed = text.trim().toLowerCase()
    setInputTxid(trimmed)
    if (detectTransactionSearchInput(trimmed) === 'txid') {
      navigate(trimmed)
    }
  }

  function handleLoad() {
    navigate(inputTxid.trim().toLowerCase())
  }

  function handleBroadcast() {
    broadcast(inputTxid.trim().toLowerCase())
  }

  function handleExample(txid: string) {
    setInputTxid(txid)
    navigate(txid)
  }

  async function handlePaste() {
    const text = await Clipboard.getStringAsync()
    handleInputContent(text)
  }

  async function handleScan() {
    if (!permission?.granted) {
      const result = await requestPermission()
      if (!result.granted) {
        return
      }
    }
    scannedRef.current = false
    setScanOpen(true)
  }

  function handleScanClose() {
    setScanOpen(false)
    scannedRef.current = false
  }

  function handleBarcodeScanned(data: string) {
    if (scannedRef.current) {
      return
    }
    scannedRef.current = true
    setScanOpen(false)
    handleInputContent(data)
  }

  return (
    <SSMainLayout style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{tn('title')}</SSText>
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack gap="md" style={styles.inputRow}>
          <SSTextInput
            placeholder={tn('placeholder')}
            value={inputTxid}
            onChangeText={setInputTxid}
            autoCapitalize="none"
            autoCorrect={false}
            align="left"
            multiline
            numberOfLines={4}
            scrollEnabled={false}
            textAlignVertical="top"
            style={styles.txidInput}
          />
          <SSHStack gap="sm">
            <SSButton
              label={tn('paste')}
              variant="outline"
              onPress={handlePaste}
              style={styles.actionButton}
            />
            <SSButton
              label={tn('scanQr')}
              variant="outline"
              onPress={handleScan}
              style={styles.actionButton}
            />
            {nfcAvailable && (
              <SSButton
                label={tn('nfc')}
                variant="outline"
                onPress={() => setNfcOpen(true)}
                style={styles.actionButton}
              />
            )}
          </SSHStack>
          <SSButton
            label={inputType === 'rawTx' ? tn('broadcast') : tn('load')}
            variant="outline"
            onPress={inputType === 'rawTx' ? handleBroadcast : handleLoad}
            loading={isBroadcasting}
            disabled={inputType === null}
          />
          {showExamples ? (
            <SSVStack gap="none">
              {EXPLORER_EXAMPLE_TRANSACTIONS.map((ex) => (
                <SSPressable
                  key={ex.txid}
                  style={styles.exampleCard}
                  onPress={() => handleExample(ex.txid)}
                >
                  <SSVStack gap="xxs" style={styles.exampleCardContent}>
                    <SSHStack gap="sm" style={styles.exampleLabelRow}>
                      <SSText
                        size="sm"
                        weight="medium"
                        style={styles.exampleLabel}
                      >
                        {ex.label}
                      </SSText>
                      <ExampleIoCount count={ex.inputs} kind="in" />
                      <ExampleIoCount count={ex.outputs} kind="out" />
                    </SSHStack>
                    <SSText size="xxs" color="muted">
                      {ex.description}
                    </SSText>
                    <SSText type="mono" size="xxs" color="muted">
                      {formatTxId(ex.txid, 'wide')}
                    </SSText>
                  </SSVStack>
                  <SSIconChevronRight
                    width={12}
                    height={12}
                    stroke={Colors.gray['600']}
                  />
                </SSPressable>
              ))}
            </SSVStack>
          ) : null}
        </SSVStack>
      </ScrollView>

      <SSModal visible={scanOpen} onClose={handleScanClose}>
        <SSQrScanner style={styles.camera} onScan={handleBarcodeScanned} />
      </SSModal>

      <SSNFCModal
        visible={nfcOpen}
        onClose={() => setNfcOpen(false)}
        onContentRead={handleInputContent}
        mode="read"
      />
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  actionButton: { flex: 1 },
  camera: { height: 300, width: '100%' },
  container: { paddingTop: 0 },
  exampleCard: {
    alignItems: 'center',
    borderBottomColor: Colors.gray['800'],
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14
  },
  exampleCardContent: { flex: 1, paddingRight: 12 },
  exampleIoRow: { alignItems: 'baseline', flexShrink: 0, width: 'auto' },
  exampleLabel: { flexShrink: 1 },
  exampleLabelRow: { alignItems: 'baseline', flexWrap: 'wrap', width: 'auto' },
  inputRow: { paddingTop: 16 },
  txidInput: { height: 96 }
})
