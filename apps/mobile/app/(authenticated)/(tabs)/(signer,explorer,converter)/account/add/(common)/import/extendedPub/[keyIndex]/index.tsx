import { URDecoder } from '@ngraveio/bc-ur'
import { Descriptor } from 'bdk-rn'
import * as CBOR from 'cbor-js'
import { CameraView, useCameraPermissions } from 'expo-camera/next'
import * as Clipboard from 'expo-clipboard'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Animated, Keyboard, ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { parseDescriptor } from '@/api/bdk'
import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useNFCReader } from '@/hooks/useNFCReader'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import { decodeBBQRChunks, isBBQRFragment } from '@/utils/bbqr'
import {
  convertKeyFormat,
  getDerivationPathFromScriptVersion,
  getMultisigDerivationPathFromScriptVersion
} from '@/utils/bitcoin'
import { validateExtendedKey, validateFingerprint } from '@/utils/validation'

type ImportExtendedPubSearchParams = {
  keyIndex: string
}

// Helper function to map local Network type to bdk-rn Network enum
function mapNetworkToBdkNetwork(network: 'bitcoin' | 'testnet' | 'signet') {
  const { Network } = require('bdk-rn/lib/lib/enums')
  switch (network) {
    case 'bitcoin':
      return Network.Bitcoin
    case 'testnet':
      return Network.Testnet
    case 'signet':
      return Network.Signet
    default:
      return Network.Bitcoin
  }
}

export default function ImportExtendedPub() {
  const { keyIndex } = useLocalSearchParams<ImportExtendedPubSearchParams>()
  const router = useRouter()
  const network = useBlockchainStore((state) => state.selectedNetwork)

  const [
    setExtendedPublicKey,
    setFingerprint,
    clearKeyState,
    setKey,
    setKeyDerivationPath,
    policyType,
    scriptVersion,
    builderNetwork
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.setExtendedPublicKey,
      state.setFingerprint,
      state.clearKeyState,
      state.setKey,
      state.setKeyDerivationPath,
      state.policyType,
      state.scriptVersion,
      state.network
    ])
  )

  const { isAvailable, isReading, readNFCTag, cancelNFCScan } = useNFCReader()
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [permission, requestPermission] = useCameraPermissions()
  const [scanningFor, setScanningFor] = useState<'main' | 'fingerprint'>('main')

  // State for import data
  const [xpub, setXpub] = useState('')
  const [localFingerprint, setLocalFingerprint] = useState('')

  // Validation state
  const [disabled, setDisabled] = useState(true)
  const [validXpub, setValidXpub] = useState(true)
  const [validMasterFingerprint, setValidMasterFingerprint] = useState(true)
  const [xpubError, setXpubError] = useState('')

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

      const scaleAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 0.98,
            duration: 500,
            useNativeDriver: false
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: false
          })
        ])
      )

      pulseAnimation.start()
      scaleAnimation.start()
      return () => {
        pulseAnimation.stop()
        scaleAnimation.stop()
      }
    } else {
      pulseAnim.setValue(0)
      scaleAnim.setValue(1)
    }
  }, [isReading, pulseAnim, scaleAnim])

  function updateMasterFingerprint(fingerprint: string) {
    const validFingerprint = validateFingerprint(fingerprint)
    setValidMasterFingerprint(!fingerprint || validFingerprint)
    setDisabled(!validXpub || !validFingerprint)
    setLocalFingerprint(fingerprint)
    if (validFingerprint) {
      setFingerprint(fingerprint)
      Keyboard.dismiss()
    }
  }

  function updateXpub(xpub: string) {
    const validXpub = validateExtendedKey(xpub, network)
    setValidXpub(!xpub || validXpub)
    setXpub(xpub)

    // For multisig accounts, use the script version from the store instead of auto-detecting
    // The script type should be determined by the multisig configuration, not the xpub prefix
    if (validXpub && localFingerprint) {
      // Use the script version from the store to determine the correct derivation path
      const derivationPath = getDerivationPathFromScriptVersion(
        scriptVersion,
        network
      )
      const formattedXpub = `[${localFingerprint}/${derivationPath}]${xpub}/0/*`
      setExtendedPublicKey(formattedXpub)
      // Don't change the script version - keep the one from the store
    }

    setDisabled(!validXpub || !localFingerprint)

    // Clear previous error first
    setXpubError('')

    // Show error message if validation fails
    if (xpub && !validXpub) {
      const errorMessage = t('account.import.error.descriptorFormat')
      setXpubError(errorMessage)
      toast.error(errorMessage)
    }
  }

  function convertVpubToTpub(vpub: string): string {
    // If it's not a vpub, return as is
    if (!vpub.startsWith('vpub')) return vpub

    // Use the network-aware conversion utility
    return convertKeyFormat(vpub, 'tpub', network)
  }

  // Helper functions for QR code detection and parsing
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

    // Single QR code (no multi-part format detected)
    return {
      type: 'single' as const,
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

  function decodeURCryptoAccount(urData: Uint8Array): any {
    try {
      const decoded = CBOR.decode(new Uint8Array(urData.buffer))
      return decoded
    } catch (_error) {
      return null
    }
  }

  const assembleMultiPartQR = (
    type: 'raw' | 'ur' | 'bbqr',
    chunks: Map<number, string>
  ): string | null => {
    try {
      if (type === 'raw') {
        // For RAW format, just concatenate the chunks in order
        const sortedChunks = Array.from(chunks.entries())
          .sort(([a], [b]) => a - b)
          .map(([, content]) => content)
        return sortedChunks.join('')
      } else if (type === 'bbqr') {
        // For BBQR, decode the assembled chunks
        const sortedChunks = Array.from(chunks.entries())
          .sort(([a], [b]) => a - b)
          .map(([, content]) => content)
        const decoded = decodeBBQRChunks(sortedChunks)
        if (decoded) {
          return Buffer.from(decoded).toString('hex')
        }
        return null
      } else if (type === 'ur') {
        // For UR, the decoder should have assembled everything
        if (urDecoderRef.current.isComplete()) {
          const result = urDecoderRef.current.resultUR()
          if (result && result.cbor) {
            return result.cbor.toString('hex')
          }
        }
      }
      return null
    } catch (_error) {
      return null
    }
  }

  async function handleConfirm() {
    if (!validXpub || !validMasterFingerprint) {
      toast.error(t('watchonly.error.invalidInput'))
      return
    }

    try {
      // Convert vpub to tpub if needed
      const convertedXpub = convertVpubToTpub(xpub)
      if (xpub !== convertedXpub) {
        toast.info(
          t('watchonly.info.vpubConverted', {
            vpub: xpub.slice(0, 8) + '...',
            tpub: convertedXpub.slice(0, 8) + '...'
          })
        )
      }

      // Extract derivation path from extended public key
      let derivationPath = ''

      if (policyType === 'multisig') {
        // For multisig accounts, always use our multisig derivation path logic
        const rawDerivationPath = getMultisigDerivationPathFromScriptVersion(
          scriptVersion,
          builderNetwork
        )
        derivationPath = `m/${rawDerivationPath}`
      } else {
        // For single-sig accounts, try to extract from descriptor first
        try {
          // Create a descriptor from the extended public key to extract derivation path
          const descriptorString = `pkh(${convertedXpub})`
          const descriptor = await new Descriptor().create(
            descriptorString,
            mapNetworkToBdkNetwork(network)
          )
          const parsedDescriptor = await parseDescriptor(descriptor)
          derivationPath = parsedDescriptor.derivationPath
        } catch {
          // Use default derivation path if extraction fails
          const rawDerivationPath = getDerivationPathFromScriptVersion(
            scriptVersion,
            builderNetwork
          )
          derivationPath = `m/${rawDerivationPath}`
        }
      }

      // Set the data in the store
      setExtendedPublicKey(convertedXpub)
      if (localFingerprint) {
        setFingerprint(localFingerprint)
      }

      // Create the key
      setKey(Number(keyIndex))

      // Set the derivation path for this key
      setKeyDerivationPath(Number(keyIndex), derivationPath)

      clearKeyState()

      toast.success(t('account.import.success'))
      router.dismiss(1)
    } catch {
      toast.error(t('import.error'))
    }
  }

  async function pasteFromClipboard() {
    try {
      const clipboardContent = await Clipboard.getStringAsync()
      if (!clipboardContent) {
        toast.error(t('watchonly.error.emptyClipboard'))
        return
      }

      const finalContent = clipboardContent.trim()
      updateXpub(finalContent)
      toast.success(t('watchonly.success.clipboardPasted'))
    } catch (_error) {
      toast.error(t('watchonly.error.clipboardPaste'))
    }
  }

  async function pasteFingerprintFromClipboard() {
    try {
      const clipboardContent = await Clipboard.getStringAsync()
      if (!clipboardContent) {
        toast.error(t('watchonly.error.emptyClipboard'))
        return
      }

      const finalContent = clipboardContent.trim()
      updateMasterFingerprint(finalContent)
      toast.success(t('watchonly.success.clipboardPasted'))
    } catch (_error) {
      toast.error(t('watchonly.error.clipboardPaste'))
    }
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

      updateXpub(text)
      toast.success(t('watchonly.success.nfcRead'))
    } catch (_error) {
      toast.error(t('watchonly.error.nfcRead'))
    }
  }

  function handleQRCodeScanned(data: string | undefined) {
    if (!data) {
      toast.error(t('watchonly.read.qrError'))
      return
    }

    // Handle fingerprint scanning
    if (scanningFor === 'fingerprint') {
      updateMasterFingerprint(data)
      setCameraModalVisible(false)
      toast.success(t('watchonly.success.qrScanned'))
      return
    }

    // Detect QR code type and format
    const qrInfo = detectQRType(data)

    // Handle single QR codes (complete data in one scan)
    if (qrInfo.type === 'single' || qrInfo.total === 1) {
      let finalContent = qrInfo.content

      // Check if the scanned data is a valid fingerprint (8 bytes hex)
      const fingerprintRegex = /^[0-9a-fA-F]{8}$/
      if (fingerprintRegex.test(qrInfo.content)) {
        updateMasterFingerprint(qrInfo.content)
        setCameraModalVisible(false)
        return
      }

      try {
        // Check if it's a single BBQR QR code
        if (isBBQRFragment(qrInfo.content)) {
          const decoded = decodeBBQRChunks([qrInfo.content])

          if (decoded) {
            // Try to convert binary data to string first (for descriptors)
            try {
              const stringResult = Buffer.from(decoded).toString('utf8')
              finalContent = stringResult
            } catch (_error) {
              // Fallback to hex if string conversion fails
              const hexResult = Buffer.from(decoded).toString('hex')
              finalContent = hexResult
            }
          } else {
            toast.error('Failed to decode BBQR QR code')
            return
          }
        }
        // Check if it looks like base64 PSBT (starts with cHNidP)
        else if (qrInfo.content.startsWith('cHNidP')) {
          const hexResult = Buffer.from(qrInfo.content, 'base64').toString(
            'hex'
          )
          finalContent = hexResult
        }
        // Check if it's a single UR QR code
        else if (qrInfo.content.toLowerCase().startsWith('ur:crypto-')) {
          try {
            const success = urDecoderRef.current.receivePart(qrInfo.content)
            if (success && urDecoderRef.current.isComplete()) {
              const result = urDecoderRef.current.resultUR()

              if (result && result.cbor) {
                const decodedAccount = decodeURCryptoAccount(
                  new Uint8Array(result.cbor)
                )

                if (decodedAccount.xpub) {
                  // Extract the fingerprint and xpub separately
                  const xpubWithPrefix = decodedAccount.xpub

                  // Extract fingerprint from the prefix [fingerprint/derivation]xpub
                  // Try multiple patterns to extract fingerprint
                  let extractedFingerprint = null

                  // Pattern 1: [fingerprint/derivation]xpub (with slash separator)
                  const fingerprintMatch1 = xpubWithPrefix.match(
                    /^\[([0-9a-fA-F]{8})\//
                  )
                  if (fingerprintMatch1) {
                    extractedFingerprint = fingerprintMatch1[1]
                  }

                  // Pattern 2: [fingerprintderivation]xpub (no slash separator - legacy)
                  if (!extractedFingerprint) {
                    const fingerprintMatch2 =
                      xpubWithPrefix.match(/^\[([0-9a-fA-F]{8})/)
                    if (fingerprintMatch2) {
                      extractedFingerprint = fingerprintMatch2[1]
                    }
                  }

                  // Pattern 3: [fingerprint...]xpub (any length hex - fallback)
                  if (!extractedFingerprint) {
                    const fingerprintMatch3 =
                      xpubWithPrefix.match(/^\[([0-9a-fA-F]+)/)
                    if (fingerprintMatch3) {
                      extractedFingerprint = fingerprintMatch3[1]
                    }
                  }

                  if (extractedFingerprint) {
                    updateMasterFingerprint(extractedFingerprint)
                  }

                  // Extract just the xpub part (remove the [fingerprint/derivation] prefix)
                  const xpubMatch = xpubWithPrefix.match(
                    /\]([txyzuv]pub[a-zA-Z0-9]{107})$/
                  )
                  if (xpubMatch) {
                    const extractedXpub = xpubMatch[1]
                    updateXpub(extractedXpub)
                  } else {
                    // Fallback: use the full string if parsing fails
                    updateXpub(xpubWithPrefix)
                  }

                  toast.success('Crypto account imported successfully')
                  setCameraModalVisible(false)
                  return
                } else {
                  toast.error('No extended public key found in crypto account')
                  return
                }
              }
            }
          } catch {
            toast.error('Failed to decode UR crypto account')
            return
          }
        }

        // Process the final content
        updateXpub(finalContent)
        setCameraModalVisible(false)
        toast.success(t('watchonly.success.qrScanned'))
      } catch (_error) {
        toast.error(t('watchonly.read.qrError'))
      }
    } else {
      // Handle multi-part QR codes
      const { type, current, total, content } = qrInfo
      const newScanned = new Set(scanProgress.scanned)
      const newChunks = new Map(scanProgress.chunks)

      newScanned.add(current)
      newChunks.set(current, content)

      setScanProgress({
        type,
        total,
        scanned: newScanned,
        chunks: newChunks
      })

      // For UR fountain encoding, we can assemble as we go
      if (type === 'ur') {
        try {
          const success = urDecoderRef.current.receivePart(content)
          if (success && urDecoderRef.current.isComplete()) {
            // All parts received, process the result
            const result = urDecoderRef.current.resultUR()

            if (result && result.cbor) {
              const decodedAccount = decodeURCryptoAccount(
                new Uint8Array(result.cbor)
              )

              if (decodedAccount.xpub) {
                // Extract the fingerprint and xpub separately
                const xpubWithPrefix = decodedAccount.xpub

                // Extract fingerprint from the prefix [fingerprint/derivation]xpub
                let extractedFingerprint = null
                const fingerprintMatch1 = xpubWithPrefix.match(
                  /^\[([0-9a-fA-F]{8})\//
                )
                if (fingerprintMatch1) {
                  extractedFingerprint = fingerprintMatch1[1]
                }

                if (!extractedFingerprint) {
                  const fingerprintMatch2 =
                    xpubWithPrefix.match(/^\[([0-9a-fA-F]{8})/)
                  if (fingerprintMatch2) {
                    extractedFingerprint = fingerprintMatch2[1]
                  }
                }

                if (!extractedFingerprint) {
                  const fingerprintMatch3 =
                    xpubWithPrefix.match(/^\[([0-9a-fA-F]+)/)
                  if (fingerprintMatch3) {
                    extractedFingerprint = fingerprintMatch3[1]
                  }
                }

                if (extractedFingerprint) {
                  updateMasterFingerprint(extractedFingerprint)
                }

                // Extract just the xpub part
                const xpubMatch = xpubWithPrefix.match(
                  /\]([txyzuv]pub[a-zA-Z0-9]{107})$/
                )
                if (xpubMatch) {
                  updateXpub(xpubMatch[1])
                } else {
                  updateXpub(xpubWithPrefix)
                }

                toast.success('Crypto account imported successfully')
                setCameraModalVisible(false)
                resetScanProgress()
              } else {
                toast.error('No extended public key found in crypto account')
              }
            }
          }
        } catch {
          toast.error('Failed to decode UR crypto account')
        }
      } else {
        // For RAW and BBQR, wait for all chunks
        if (newScanned.size === total) {
          // All chunks collected, assemble the final result
          const assembledData = assembleMultiPartQR(type, newChunks)

          if (assembledData) {
            setCameraModalVisible(false)
            resetScanProgress()

            // Process the assembled data
            updateXpub(assembledData)
            toast.success(t('watchonly.success.qrScanned'))
          } else {
            toast.error('Failed to assemble multi-part QR code')
            resetScanProgress()
          }
        }
      }
    }
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('account.import.extendedPub')}</SSText>
          )
        }}
      />
      <ScrollView>
        <SSVStack justifyBetween gap="lg" style={{ paddingBottom: 20 }}>
          <SSVStack gap="lg">
            <SSVStack gap="lg">
              <SSVStack gap="sm">
                <SSVStack gap="xxs">
                  <SSText center>{t('common.extendedPublicKey')}</SSText>
                  <SSTextInput
                    value={xpub}
                    style={validXpub ? styles.valid : styles.invalid}
                    onChangeText={updateXpub}
                    multiline
                  />
                  {xpubError && (
                    <SSText
                      style={{
                        color: Colors.error,
                        fontSize: 12,
                        textAlign: 'center',
                        marginTop: 4
                      }}
                    >
                      {xpubError}
                    </SSText>
                  )}
                </SSVStack>
                <SSVStack gap="sm">
                  <SSHStack gap="sm">
                    <SSButton
                      label="Paste"
                      onPress={pasteFromClipboard}
                      style={{ flex: 1 }}
                      variant="subtle"
                    />
                    <SSButton
                      label="Scan QR"
                      onPress={() => {
                        setScanningFor('main')
                        setCameraModalVisible(true)
                      }}
                      style={{ flex: 1 }}
                      variant="subtle"
                    />
                  </SSHStack>
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
                      variant="subtle"
                      onPress={handleNFCRead}
                      disabled={!isAvailable}
                    />
                  </Animated.View>
                </SSVStack>
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
                  <View
                    style={{
                      width: '100%',
                      height: 4,
                      backgroundColor: Colors.gray[700],
                      borderRadius: 2
                    }}
                  >
                    <View
                      style={{
                        width: `${
                          (scanProgress.scanned.size / scanProgress.total) * 100
                        }%`,
                        height: 4,
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
                  <SSButton
                    label="Reset Scan"
                    variant="ghost"
                    onPress={resetScanProgress}
                  />
                </SSVStack>
              )}
            </SSVStack>
            <SSVStack gap="lg">
              <SSVStack gap="sm">
                <SSText center>{t('common.fingerprint')}</SSText>
                <SSTextInput
                  value={localFingerprint}
                  onChangeText={updateMasterFingerprint}
                  style={validMasterFingerprint ? styles.valid : styles.invalid}
                />

                <SSHStack gap="sm">
                  <SSButton
                    style={{ flex: 1 }}
                    label="Paste"
                    variant="subtle"
                    onPress={pasteFingerprintFromClipboard}
                  />
                  <SSButton
                    style={{ flex: 1 }}
                    label="Scan QR"
                    variant="subtle"
                    onPress={() => {
                      setScanningFor('fingerprint')
                      setCameraModalVisible(true)
                    }}
                  />
                </SSHStack>
              </SSVStack>
              <SSButton
                label={t('common.confirm')}
                variant="secondary"
                disabled={disabled}
                onPress={handleConfirm}
              />
              <SSButton
                label={t('common.cancel')}
                variant="ghost"
                onPress={() => router.dismiss(1)}
              />
            </SSVStack>
          </SSVStack>
        </SSVStack>
      </ScrollView>
      <SSModal
        visible={cameraModalVisible}
        fullOpacity
        onClose={() => {
          setCameraModalVisible(false)
          setScanningFor('main')
          resetScanProgress()
        }}
      >
        <SSVStack itemsCenter gap="md">
          <SSText color="muted" uppercase>
            {scanningFor === 'fingerprint'
              ? t('watchonly.fingerprint.scanQR')
              : scanProgress.type
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
            <SSVStack itemsCenter gap="xs" style={{ marginBottom: 10 }}>
              {scanProgress.type === 'ur' ? (
                // For UR fountain encoding, show the actual target
                <>
                  {(() => {
                    const maxFragment = Math.max(...scanProgress.scanned)
                    const actualTotal = maxFragment + 1
                    const conservativeTarget = Math.ceil(actualTotal * 1.1)
                    const theoreticalTarget = Math.ceil(
                      scanProgress.total * 1.5
                    )
                    const displayTarget = Math.min(
                      conservativeTarget,
                      theoreticalTarget
                    )

                    return (
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
                                (scanProgress.scanned.size / displayTarget) *
                                300,
                              height: 4,
                              maxWidth: 300,
                              backgroundColor: Colors.white,
                              borderRadius: 2
                            }}
                          />
                        </View>
                      </>
                    )
                  })()}
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
                        maxWidth: scanProgress.total * 300,
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
              )}
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

const styles = StyleSheet.create({
  invalid: {
    borderColor: Colors.error,
    borderWidth: 1,
    height: 'auto',
    paddingVertical: 10
  },
  valid: { height: 'auto', paddingVertical: 10 }
})
