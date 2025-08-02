import { URDecoder } from '@ngraveio/bc-ur'
import bs58check from 'bs58check'
import * as CBOR from 'cbor-js'
import { CameraView, useCameraPermissions } from 'expo-camera/next'
import * as Clipboard from 'expo-clipboard'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, Keyboard, ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useNFCReader } from '@/hooks/useNFCReader'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import { type ImportDescriptorSearchParams } from '@/types/navigation/searchParams'
import { decodeBBQRChunks, isBBQRFragment } from '@/utils/bbqr'
import { decodeMultiPartURToPSBT, decodeURToPSBT } from '@/utils/ur'
import { validateDescriptor } from '@/utils/validation'

export default function ImportDescriptor() {
  const { keyIndex } = useLocalSearchParams<ImportDescriptorSearchParams>()
  const router = useRouter()
  const network = useBlockchainStore((state) => state.selectedNetwork)

  const { isAvailable, isReading, readNFCTag, cancelNFCScan } = useNFCReader()
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [permission, requestPermission] = useCameraPermissions()

  // State for import data
  const [externalDescriptor, setExternalDescriptor] = useState('')
  const [internalDescriptor, setInternalDescriptor] = useState('')

  // Validation state
  const [disabled, setDisabled] = useState(true)
  const [validExternalDescriptor, setValidExternalDescriptor] = useState(true)
  const [validInternalDescriptor, setValidInternalDescriptor] = useState(true)

  // Multipart QR scanning state
  const urDecoderRef = useRef<URDecoder>(new URDecoder())
  const [scanProgress, setScanProgress] = useState<{
    type: 'raw' | 'ur' | 'bbqr' | null
    total: number
    scanned: Set<number>
    chunks: Map<number, string>
  }>({
    type: null,
    total: 0,
    scanned: new Set(),
    chunks: new Map()
  })

  const pulseAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (isReading) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: false
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: false
          })
        ])
      )

      pulseAnimation.start()

      return () => {
        pulseAnimation.stop()
      }
    }
  }, [isReading, pulseAnim])

  const [
    setKey,
    setStoreExternalDescriptor,
    setStoreInternalDescriptor,
    updateKeyFingerprint,
    setKeyDerivationPath,
    setExtendedPublicKey,
    clearKeyState
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.setKey,
      state.setExternalDescriptor,
      state.setInternalDescriptor,
      state.updateKeyFingerprint,
      state.setKeyDerivationPath,
      state.setExtendedPublicKey,
      state.clearKeyState
    ])
  )

  const updateDescriptorValidationState = useCallback(() => {
    // Allow import if either external or internal descriptor is valid
    // At least one descriptor must be provided and valid
    const hasValidExternal = externalDescriptor && validExternalDescriptor
    const hasValidInternal = internalDescriptor && validInternalDescriptor
    const hasAnyValidDescriptor = hasValidExternal || hasValidInternal
    setDisabled(!hasAnyValidDescriptor)
  }, [
    externalDescriptor,
    internalDescriptor,
    validExternalDescriptor,
    validInternalDescriptor
  ])

  // Initialize validation state when descriptors change
  useEffect(() => {
    updateDescriptorValidationState()
  }, [
    externalDescriptor,
    internalDescriptor,
    validExternalDescriptor,
    validInternalDescriptor,
    updateDescriptorValidationState
  ])

  function updateExternalDescriptor(descriptor: string) {
    console.log('updateExternalDescriptor', descriptor)
    const validExternalDescriptor =
      validateDescriptor(descriptor) && !descriptor.match(/[txyz]priv/)

    setValidExternalDescriptor(!descriptor || validExternalDescriptor)
    setExternalDescriptor(descriptor)
    if (validExternalDescriptor) {
      setStoreExternalDescriptor(descriptor)
    }
  }

  function updateInternalDescriptor(descriptor: string) {
    console.log('updateInternalDescriptor', descriptor)
    const validInternalDescriptor = validateDescriptor(descriptor)

    setValidInternalDescriptor(!descriptor || validInternalDescriptor)
    setInternalDescriptor(descriptor)
    if (validInternalDescriptor) {
      setStoreInternalDescriptor(descriptor)
    }
  }

  const detectQRType = (data: string) => {
    // Check for RAW format (pXofY header)
    if (/^p\d+of\d+\s/.test(data)) {
      const match = data.match(/^p(\d+)of(\d+)\s/)
      if (match) {
        return {
          type: 'raw' as const,
          current: parseInt(match[1], 10) - 1, // Convert to 0-based index
          total: parseInt(match[2], 10),
          content: data.substring(match[0].length)
        }
      }
    }

    // Check for BBQR format
    if (isBBQRFragment(data)) {
      const total = parseInt(data.slice(4, 6), 36)
      const current = parseInt(data.slice(6, 8), 36)
      return {
        type: 'bbqr' as const,
        current,
        total,
        content: data
      }
    }

    // Check for UR format (crypto-account, crypto-psbt, etc.)
    if (data.toLowerCase().startsWith('ur:crypto-')) {
      // UR format: ur:crypto-*/[sequence]/[data] for multi-part
      // or ur:crypto-*/[data] for single part
      const urMatch = data.match(/^ur:crypto-[^/]+\/(?:(\d+)-(\d+)\/)?(.+)$/i)
      if (urMatch) {
        const [, currentStr, totalStr] = urMatch

        if (currentStr && totalStr) {
          // Multi-part UR
          const current = parseInt(currentStr, 10) - 1 // Convert to 0-based index
          const total = parseInt(totalStr, 10)
          return {
            type: 'ur' as const,
            current,
            total,
            content: data
          }
        } else {
          // Single-part UR
          return {
            type: 'ur' as const,
            current: 0,
            total: 1,
            content: data
          }
        }
      }
    }

    // Default to raw data
    return {
      type: 'raw' as const,
      current: 0,
      total: 1,
      content: data
    }
  }

  function resetScanProgress() {
    setScanProgress({
      type: null,
      total: 0,
      scanned: new Set(),
      chunks: new Map()
    })
    urDecoderRef.current = new URDecoder()
  }

  async function handleConfirm() {
    try {
      // Set the descriptors in the store
      setStoreExternalDescriptor(externalDescriptor)
      if (internalDescriptor.trim()) {
        setStoreInternalDescriptor(internalDescriptor)
      }

      // Set the key data
      setKey(Number(keyIndex))
      clearKeyState()

      toast.success(t('import.success'))
      router.dismiss(1)
    } catch (error) {
      toast.error(t('import.error'))
    }
  }

  async function pasteFromClipboard() {
    const text = await Clipboard.getStringAsync()

    if (!text) return

    let externalDescriptor = text
    let internalDescriptor = ''

    // Try to parse as JSON first
    try {
      const jsonData = JSON.parse(text)

      if (jsonData.descriptor) {
        externalDescriptor = jsonData.descriptor

        // Derive internal descriptor from external descriptor
        // Replace /0/* with /1/* for internal chain
        const descriptorWithoutChecksum = externalDescriptor.replace(
          /#[a-z0-9]+$/,
          ''
        )
        internalDescriptor = descriptorWithoutChecksum.replace(
          /\/0\/\*/g,
          '/1/*'
        )
        // Add back the checksum to internal descriptor
        const checksum = externalDescriptor.match(/#[a-z0-9]+$/)
        if (checksum) {
          internalDescriptor += checksum[0]
        }
      }
    } catch (_jsonError) {
      // Handle legacy formats
      if (text.match(/<0[,;]1>/)) {
        externalDescriptor = text.replace(/<0[,;]1>/, '0')
        internalDescriptor = text.replace(/<0[,;]1>/, '1')
      }
      if (text.includes('\n')) {
        const lines = text.split('\n')
        externalDescriptor = lines[0]
        internalDescriptor = lines[1]
      }
    }

    if (externalDescriptor) updateExternalDescriptor(externalDescriptor)
    if (internalDescriptor) updateInternalDescriptor(internalDescriptor)
  }

  async function handleNFCRead() {
    if (isReading) {
      await cancelNFCScan()
      return
    }

    try {
      const nfcData = await readNFCTag()

      if (!nfcData) {
        toast.error(t('watchonly.read.nfcErrorNoData'))
        return
      }

      if (!nfcData.text) {
        toast.error(t('watchonly.read.nfcErrorNoData'))
        return
      }

      const text = nfcData.text
        .trim()
        .replace(/[^\S\n]+/g, '') // Remove all whitespace except newlines
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces and other invisible characters
        .replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g, '') // Remove control characters except \n
        .normalize('NFKC') // Normalize unicode characters
        .replace(/^en/, '')

      let externalDescriptor = text
      let internalDescriptor = ''
      if (text.match(/<0[,;]1>/)) {
        externalDescriptor = text.replace(/<0[,;]1>/, '0')
        internalDescriptor = text.replace(/<0[,;]1>/, '1')
      }
      if (text.includes('\n')) {
        const lines = text.split('\n')
        externalDescriptor = lines[0]
        internalDescriptor = lines[1]
      }
      if (externalDescriptor) updateExternalDescriptor(externalDescriptor)
      if (internalDescriptor) updateInternalDescriptor(internalDescriptor)

      toast.success(t('watchonly.success.nfcRead'))
    } catch (error) {
      toast.error(t('watchonly.error.nfcRead'))
    }
  }

  function handleQRCodeScanned(scanningResult: any) {
    const data = scanningResult?.data
    if (!data) {
      toast.error(t('watchonly.read.qrError'))
      return
    }

    // Detect QR code type and format
    const qrInfo = detectQRType(data)

    // Handle single QR codes (complete data in one scan)
    if (qrInfo.total === 1) {
      let finalContent = qrInfo.content

      // Try to parse as UR format
      if (qrInfo.type === 'ur') {
        try {
          const urData = decodeURToPSBT(qrInfo.content)
          if (urData) {
            finalContent = String(urData)
          }
        } catch {
          // If UR parsing fails, use raw content
        }
      }

      // Try to parse as BBQR format
      if (qrInfo.type === 'bbqr') {
        try {
          const bbqrData = decodeBBQRChunks([qrInfo.content])
          if (bbqrData) {
            finalContent = String(bbqrData)
          }
        } catch {
          // If BBQR parsing fails, use raw content
        }
      }

      updateExternalDescriptor(finalContent)
      setCameraModalVisible(false)
      toast.success(t('watchonly.success.qrScanned'))
      return
    }

    // Handle multi-part QR codes
    if (qrInfo.total > 1) {
      const { current, total, content } = qrInfo
      const newChunks = new Map(scanProgress.chunks)
      newChunks.set(current, content)

      const newScanned = new Set(scanProgress.scanned)
      newScanned.add(current)

      setScanProgress({
        type: qrInfo.type,
        total,
        scanned: newScanned,
        chunks: newChunks
      })

      // Check if we have all chunks
      if (newScanned.size === total) {
        const assembledData = assembleMultiPartQR(qrInfo.type, newChunks)
        if (assembledData) {
          updateExternalDescriptor(assembledData)
          setCameraModalVisible(false)
          toast.success(t('watchonly.success.qrScanned'))
        }
        resetScanProgress()
      }
    }
  }

  const assembleMultiPartQR = (
    type: 'raw' | 'ur' | 'bbqr',
    chunks: Map<number, string>
  ): string | null => {
    try {
      const sortedChunks = Array.from(chunks.entries())
        .sort(([a], [b]) => a - b)
        .map(([, content]) => content)

      const combinedData = sortedChunks.join('')

      switch (type) {
        case 'ur':
          const urResult = decodeURToPSBT(combinedData)
          return urResult ? String(urResult) : combinedData
        case 'bbqr':
          const bbqrResult = decodeBBQRChunks([combinedData])
          return bbqrResult ? String(bbqrResult) : combinedData
        case 'raw':
        default:
          return combinedData
      }
    } catch {
      return null
    }
  }

  const styles = StyleSheet.create({
    invalid: {
      borderColor: Colors.error,
      borderWidth: 1,
      height: 'auto',
      paddingVertical: 10
    },
    valid: { height: 'auto', paddingVertical: 10 }
  })

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('account.import.descriptor')}</SSText>
          )
        }}
      />
      <ScrollView>
        <SSVStack justifyBetween gap="lg" style={{ paddingBottom: 20 }}>
          <SSVStack gap="lg">
            <SSVStack gap="sm">
              <SSVStack gap="xxs">
                <SSText center>{t('watchonly.importDescriptor.label')}</SSText>
                <SSTextInput
                  value={externalDescriptor}
                  style={
                    validExternalDescriptor ? styles.valid : styles.invalid
                  }
                  onChangeText={updateExternalDescriptor}
                  multiline
                />
              </SSVStack>
              <SSVStack gap="xxs">
                <SSText center>
                  {t('watchonly.importDescriptor.internal')}
                </SSText>
                <SSTextInput
                  value={internalDescriptor}
                  style={
                    validInternalDescriptor ? styles.valid : styles.invalid
                  }
                  multiline
                  onChangeText={updateInternalDescriptor}
                />
              </SSVStack>
            </SSVStack>
            <SSVStack>
              <SSButton
                label={t('watchonly.read.clipboard')}
                onPress={pasteFromClipboard}
              />
              <SSButton
                label={t('watchonly.read.qrcode')}
                onPress={() => setCameraModalVisible(true)}
              />
              <Animated.View
                style={{
                  opacity: pulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0.7]
                  }),
                  transform: [{ scale: scaleAnim }],
                  overflow: 'hidden'
                }}
              >
                <SSButton
                  label={
                    isReading
                      ? t('watchonly.read.scanning')
                      : t('watchonly.read.nfc')
                  }
                  onPress={handleNFCRead}
                  disabled={!isAvailable}
                />
              </Animated.View>
            </SSVStack>

            {/* Multi-part QR Scanning Progress */}
            {scanProgress.type && scanProgress.total > 1 && (
              <SSVStack gap="sm">
                <SSText center size="sm" color="muted">
                  {scanProgress.type.toUpperCase()} QR Code Scan Progress
                </SSText>
                <SSText center size="md">
                  {scanProgress.scanned.size} / {scanProgress.total} parts
                </SSText>
                <SSButton
                  label="Reset Scan"
                  variant="ghost"
                  onPress={resetScanProgress}
                />
              </SSVStack>
            )}
          </SSVStack>
          <SSVStack gap="sm">
            <SSButton
              label={t('common.confirm')}
              variant="secondary"
              disabled={disabled}
              onPress={handleConfirm}
            />
            <SSButton
              label={t('common.cancel')}
              variant="ghost"
              onPress={() => router.dismiss(2)}
            />
          </SSVStack>
        </SSVStack>
      </ScrollView>

      <SSModal
        visible={cameraModalVisible}
        fullOpacity
        onClose={() => {
          setCameraModalVisible(false)
          resetScanProgress()
        }}
      >
        <SSVStack itemsCenter gap="md">
          <SSText color="muted" uppercase>
            {scanProgress.type
              ? `Scanning ${scanProgress.type.toUpperCase()} QR Code`
              : t('camera.scanQRCode')}
          </SSText>

          <CameraView
            onBarcodeScanned={(res) => {
              handleQRCodeScanned(res.raw)
            }}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            style={{ width: 340, height: 340 }}
          />

          {/* Show progress if scanning multi-part QR */}
          {scanProgress.type && scanProgress.total > 1 && (
            <SSVStack gap="sm">
              {(() => {
                const displayTarget =
                  scanProgress.type === 'ur' ? 10 : scanProgress.total
                return scanProgress.type === 'ur' ? (
                  <>
                    <SSText color="white" center>
                      {`UR fountain encoding: ${scanProgress.scanned.size}/${displayTarget} fragments`}
                    </SSText>
                    <View
                      style={{
                        width: 300,
                        height: 4,
                        backgroundColor: Colors.gray[700],
                        borderRadius: 2
                      }}
                    >
                      <View
                        style={{
                          width:
                            (scanProgress.scanned.size / displayTarget) * 300,
                          height: 4,
                          maxWidth: 300,
                          backgroundColor: Colors.white,
                          borderRadius: 2
                        }}
                      />
                    </View>
                  </>
                ) : (
                  // For RAW and BBQR, show normal progress
                  <>
                    <SSText color="white" center>
                      {`Progress: ${scanProgress.scanned.size}/${scanProgress.total} chunks`}
                    </SSText>
                    <View
                      style={{
                        width: 300,
                        height: 4,
                        backgroundColor: Colors.gray[700],
                        borderRadius: 2
                      }}
                    >
                      <View
                        style={{
                          width:
                            (scanProgress.scanned.size / scanProgress.total) *
                            300,
                          height: 4,
                          maxWidth: 300,
                          backgroundColor: Colors.white,
                          borderRadius: 2
                        }}
                      />
                    </View>
                    <SSText color="muted" size="sm" center>
                      {`Scanned parts: ${Array.from(scanProgress.scanned)
                        .sort((a, b) => a - b)
                        .map((n) => n + 1)
                        .join(', ')}`}
                    </SSText>
                  </>
                )
              })()}
            </SSVStack>
          )}

          <SSHStack>
            {!permission?.granted && (
              <SSButton
                label={t('camera.enableCameraAccess')}
                onPress={requestPermission}
              />
            )}
          </SSHStack>

          {/* Reset button for multi-part scans */}
          {scanProgress.type && (
            <SSHStack>
              <SSButton
                label="Reset Scan"
                variant="outline"
                onPress={resetScanProgress}
                style={{ marginTop: 10, width: 200 }}
              />
            </SSHStack>
          )}
        </SSVStack>
      </SSModal>
    </SSMainLayout>
  )
}
