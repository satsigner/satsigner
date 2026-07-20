import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Clipboard from 'expo-clipboard'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { toast } from 'sonner-native'

import { SSIconChevronRight } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { EXPLORER_EXAMPLE_ADDRESSES } from '@/constants/explorerExamples'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { tn as _tn } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'

const tn = _tn('explorer.address')

function formatExampleAddress(address: string): string {
  if (address.length <= 20) {
    return address
  }
  return `${address.slice(0, 10)}...${address.slice(-8)}`
}

export default function ExplorerAddress() {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [scanOpen, setScanOpen] = useState(false)
  const [permission, requestPermission] = useCameraPermissions()
  const selectedNetwork = useBlockchainStore((state) => state.selectedNetwork)
  const showExamples = selectedNetwork === 'bitcoin'

  function navigate(address: string) {
    const trimmed = address.trim()
    if (!trimmed) {
      toast.error(tn('invalid'))
      return
    }
    router.push({
      params: { address: trimmed },
      pathname: '/explorer/address/[address]'
    })
  }

  function handleLoad() {
    navigate(input)
  }

  function handleExample(address: string) {
    setInput(address)
    navigate(address)
  }

  async function handlePaste() {
    const text = await Clipboard.getStringAsync()
    const trimmed = text.trim()
    if (!trimmed) {
      return
    }
    setInput(trimmed)
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
    const trimmed = data.trim()
    setInput(trimmed)
    navigate(trimmed)
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
            value={input}
            onChangeText={setInput}
            autoCapitalize="none"
            autoCorrect={false}
            align="left"
            multiline
            numberOfLines={3}
            scrollEnabled={false}
            textAlignVertical="top"
            style={styles.addressInput}
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
          </SSHStack>
          <SSButton
            label={tn('load')}
            variant="outline"
            onPress={handleLoad}
            disabled={input.trim().length === 0}
          />
          {showExamples ? (
            <SSVStack gap="none">
              {EXPLORER_EXAMPLE_ADDRESSES.map((ex) => (
                <TouchableOpacity
                  key={ex.address}
                  style={styles.exampleCard}
                  onPress={() => handleExample(ex.address)}
                >
                  <SSVStack gap="xxs" style={styles.exampleCardContent}>
                    <SSText size="sm" weight="medium">
                      {ex.label}
                    </SSText>
                    <SSText size="xxs" color="muted">
                      {ex.description}
                    </SSText>
                    <SSText type="mono" size="xxs" color="muted">
                      {formatExampleAddress(ex.address)}
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
          ) : null}
        </SSVStack>
      </ScrollView>

      <SSModal visible={scanOpen} onClose={() => setScanOpen(false)}>
        <CameraView
          style={styles.camera}
          onBarcodeScanned={handleBarcodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
      </SSModal>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  actionButton: { flex: 1 },
  addressInput: { height: 96 },
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
  inputRow: { paddingTop: 16 }
})
