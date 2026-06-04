import { useMutation } from '@tanstack/react-query'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Clipboard from 'expo-clipboard'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import { SSIconChevronRight } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSNFCModal from '@/components/SSNFCModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useNFCReader } from '@/hooks/useNFCReader'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { tn as _tn } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'

const tn = _tn('explorer.transaction')

const TXID_LENGTH = 64
const HEX_REGEX = /^[0-9a-f]+$/

function detectInputType(value: string): 'txid' | 'rawTx' | null {
  const v = value.trim().toLowerCase()
  if (!v || !HEX_REGEX.test(v)) {
    return null
  }
  if (v.length === TXID_LENGTH) {
    return 'txid'
  }
  if (v.length > TXID_LENGTH && v.length % 2 === 0) {
    return 'rawTx'
  }
  return null
}

async function broadcastRawTx(
  hex: string,
  url: string,
  backend: string
): Promise<string> {
  if (backend === 'electrum') {
    const client = await ElectrumClient.initClientFromUrl(url)
    try {
      return await client.broadcastTransactionHex(hex)
    } finally {
      client.close()
    }
  }
  const esplora = new Esplora(url)
  return esplora.broadcastTransaction(hex)
}

const EXAMPLE_TRANSACTIONS = [
  {
    description:
      'First Bitcoin transaction between two people — Satoshi sent 10 BTC to Hal Finney (Jan 12, 2009)',
    label: 'First Tx',
    txid: 'f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16'
  },
  {
    description:
      'First known Bitcoin sale to USD — Martti "Sirius" Malmi sold 5,050 BTC for $5.02 (2009)',
    label: 'First BTC Sale',
    txid: '7dff938918f07619abd38e4510890396b1cef4fbeca154fb7aafba8843295ea2'
  },
  {
    description:
      'First real-world Bitcoin purchase — 10,000 BTC for two pizzas (May 22, 2010)',
    label: 'Pizza Day',
    txid: 'a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d'
  },
  {
    description:
      '500,000 BTC moved in a single transaction — largest BTC amount ever (Nov 2011)',
    label: '500K BTC',
    txid: '29a3efd3ef04f9153d47a990bd7b048a4b2d213daaa5fb8ed670fb85f13bdbcf'
  },
  {
    description:
      '194,993 BTC transferred — likely a major exchange or whale (Nov 2013)',
    label: '195K BTC',
    txid: '1c12443203a48f42cdf7b1acee5b4b1c1fedc144cb909a3bf5edbffafb0cd204'
  },
  {
    description: '180,000 BTC moved in a single output (Mar 2014)',
    label: '180K BTC',
    txid: '4ee89f7cf824a85ad5f11d52604ffdebe9f01302bcea8ddec0af450f9185ddf1'
  },
  {
    description:
      '130,004 BTC transferred, 66,633 BTC retained by sender (Jan 2019)',
    label: '130K BTC',
    txid: 'f6c98463b7b6bc9c866e66a1341dac29e524071c553282f583e30f3009afb901'
  },
  {
    description: '109,232 BTC — $491M at transaction time (Nov 2018)',
    label: '109K BTC',
    txid: '1ee11c8a24c9244f14c4d5a9c3670c13664f4ae8f7738c31b4f21221a5bdfbd1'
  },
  {
    description:
      '94,504 BTC — largest USD amount ever moved at its time, $1B (Sep 2019)',
    label: '$1B Move',
    txid: '4410c8d14ff9f87ceeed1d65cb58e7c7b2422b2d7529afc675208ce2ce09ed7d'
  }
]

export default function ExplorerTransaction() {
  const router = useRouter()
  const [inputTxid, setInputTxid] = useState('')
  const [scanOpen, setScanOpen] = useState(false)
  const [nfcOpen, setNfcOpen] = useState(false)
  const [permission, requestPermission] = useCameraPermissions()
  const { isAvailable: nfcAvailable } = useNFCReader()

  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]

  const inputType = detectInputType(inputTxid)

  const { mutate: broadcast, isPending: isBroadcasting } = useMutation({
    mutationFn: (hex: string) =>
      broadcastRawTx(hex, server.url, server.backend),
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
    if (trimmed.length === TXID_LENGTH) {
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
    setScanOpen(true)
  }

  function handleBarcodeScanned({ data }: { data: string }) {
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
          <SSVStack gap="none">
            {EXAMPLE_TRANSACTIONS.map((ex) => (
              <TouchableOpacity
                key={ex.txid}
                style={styles.exampleCard}
                onPress={() => handleExample(ex.txid)}
              >
                <SSVStack gap="xxs" style={styles.exampleCardContent}>
                  <SSText size="sm" weight="medium">
                    {ex.label}
                  </SSText>
                  <SSText size="xxs" color="muted">
                    {ex.description}
                  </SSText>
                  <SSText type="mono" size="xxs" color="muted">
                    {ex.txid.slice(0, 8)}...{ex.txid.slice(-8)}
                  </SSText>
                </SSVStack>
                <SSIconChevronRight
                  width={12}
                  height={12}
                  stroke={Colors.gray['600']}
                />
              </TouchableOpacity>
            ))}
          </SSVStack>
        </SSVStack>
      </ScrollView>

      <SSModal visible={scanOpen} onClose={() => setScanOpen(false)}>
        <CameraView
          style={styles.camera}
          onBarcodeScanned={handleBarcodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
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
  inputRow: { paddingTop: 16 },
  txidInput: { height: 96 }
})
