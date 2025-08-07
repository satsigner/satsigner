import { URDecoder } from '@ngraveio/bc-ur'
import { Descriptor } from 'bdk-rn'
import { type Network } from 'bdk-rn/lib/lib/enums'
import { CameraView, useCameraPermissions } from 'expo-camera/next'
import * as Clipboard from 'expo-clipboard'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, Keyboard, ScrollView, StyleSheet } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useNFCReader } from '@/hooks/useNFCReader'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import { type CreationType } from '@/types/models/Account'
import { isBBQRFragment } from '@/utils/bbqr'
import { convertKeyFormat } from '@/utils/bitcoin'
import {
  isCombinedDescriptor,
  validateAddress,
  validateCombinedDescriptor,
  validateDescriptor,
  validateDescriptorFormat,
  validateExtendedKey,
  validateFingerprint
} from '@/utils/validation'

type ImportKeyProps = {
  importType: 'descriptor' | 'extendedPub' | 'importAddress'
  keyIndex?: number
  scriptVersion?: string
  onConfirm: (data: {
    externalDescriptor?: string
    internalDescriptor?: string
    xpub?: string
    fingerprint?: string
  }) => void
  onCancel: () => void
  showDescription?: boolean
  showFingerprint?: boolean
}

export default function SSImportKey({
  importType,
  scriptVersion,
  onConfirm,
  onCancel,
  showDescription = true,
  showFingerprint = true
}: ImportKeyProps) {
  const network = useBlockchainStore((state) => state.selectedNetwork)
  const { isAvailable, isReading, readNFCTag } = useNFCReader()
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [permission, requestPermission] = useCameraPermissions()

  // State for import data
  const [xpub, setXpub] = useState('')
  const [localFingerprint, setLocalFingerprint] = useState('')
  const [externalDescriptor, setLocalExternalDescriptor] = useState('')
  const [internalDescriptor, setLocalInternalDescriptor] = useState('')
  const [address, setAddress] = useState('')

  // Validation state
  const [disabled, setDisabled] = useState(true)
  const [validAddress, setValidAddress] = useState(true)
  const [validExternalDescriptor, setValidExternalDescriptor] = useState(true)
  const [validInternalDescriptor, setValidInternalDescriptor] = useState(true)
  const [validXpub, setValidXpub] = useState(true)
  const [validMasterFingerprint, setValidMasterFingerprint] = useState(true)

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

  const updateDescriptorValidationState = useCallback(() => {
    // Allow import if either external or internal descriptor is valid
    // At least one descriptor must be provided and valid
    const hasValidExternal = externalDescriptor && validExternalDescriptor
    const hasValidInternal = internalDescriptor && validInternalDescriptor
    const hasAnyValidDescriptor = hasValidExternal || hasValidInternal

    if (importType === 'descriptor') {
      setDisabled(!hasAnyValidDescriptor)
    }
  }, [
    externalDescriptor,
    internalDescriptor,
    validExternalDescriptor,
    validInternalDescriptor,
    importType
  ])

  // Initialize validation state when import type changes
  useEffect(() => {
    if (importType === 'descriptor') {
      updateDescriptorValidationState()
    }
  }, [
    importType,
    externalDescriptor,
    internalDescriptor,
    validExternalDescriptor,
    validInternalDescriptor,
    updateDescriptorValidationState
  ])

  function updateAddress(address: string) {
    const validAddress = address.includes('\n')
      ? address.split('\n').every(validateAddress)
      : validateAddress(address)
    setValidAddress(!address || validAddress)
    if (importType === 'importAddress') {
      setDisabled(!validAddress)
    }
    setAddress(address)
  }

  function updateMasterFingerprint(fingerprint: string) {
    const validFingerprint = validateFingerprint(fingerprint)
    setValidMasterFingerprint(!fingerprint || validFingerprint)
    if (importType === 'extendedPub') {
      setDisabled(!validXpub || !validFingerprint)
    }
    setLocalFingerprint(fingerprint)
    if (validFingerprint) {
      Keyboard.dismiss()
    }
  }

  function updateXpub(xpub: string) {
    const validXpub = validateExtendedKey(xpub, network)
    setValidXpub(!xpub || validXpub)
    if (importType === 'extendedPub') {
      setDisabled(!validXpub || !localFingerprint)
    }
    setXpub(xpub)
  }

  async function updateExternalDescriptor(
    descriptor: string,
    skipChecksumValidation = false
  ) {
    const descriptorValidation = skipChecksumValidation
      ? await validateDescriptorFormat(descriptor)
      : await validateDescriptor(descriptor)
    const basicValidation =
      descriptorValidation.isValid && !descriptor.match(/[txyz]priv/)

    // Network validation - check if descriptor is compatible with selected network
    let networkValidation: { isValid: boolean; error?: string } = {
      isValid: true
    }
    if (basicValidation && descriptor) {
      try {
        // Try to create descriptor with BDK to check network compatibility
        await new Descriptor().create(descriptor, network as Network)
        networkValidation = { isValid: true }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        if (
          errorMessage.includes('Invalid network') ||
          errorMessage.includes('network')
        ) {
          networkValidation = {
            isValid: false,
            error: 'networkIncompatible'
          }
        } else {
          // For other BDK errors, still consider it valid for now
          networkValidation = { isValid: true }
        }
      }
    }

    const validExternalDescriptor = basicValidation && networkValidation.isValid

    setValidExternalDescriptor(!descriptor || validExternalDescriptor)
    setLocalExternalDescriptor(descriptor)

    // Update disabled state based on both external and internal descriptors
    updateDescriptorValidationState()
  }

  async function updateInternalDescriptor(
    descriptor: string,
    skipChecksumValidation = false
  ) {
    const descriptorValidation = skipChecksumValidation
      ? await validateDescriptorFormat(descriptor)
      : await validateDescriptor(descriptor)
    const basicValidation = descriptorValidation.isValid

    // Network validation - check if descriptor is compatible with selected network
    let networkValidation: { isValid: boolean; error?: string } = {
      isValid: true
    }
    if (basicValidation && descriptor) {
      try {
        // Try to create descriptor with BDK to check network compatibility
        await new Descriptor().create(descriptor, network as Network)
        networkValidation = { isValid: true }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        if (
          errorMessage.includes('Invalid network') ||
          errorMessage.includes('network')
        ) {
          networkValidation = {
            isValid: false,
            error: 'networkIncompatible'
          }
        } else {
          // For other BDK errors, still consider it valid for now
          networkValidation = { isValid: true }
        }
      }
    }

    const validInternalDescriptor = basicValidation && networkValidation.isValid

    setValidInternalDescriptor(!descriptor || validInternalDescriptor)
    setLocalInternalDescriptor(descriptor)

    // Update disabled state based on both external and internal descriptors
    updateDescriptorValidationState()
  }

  function convertVpubToTpub(vpub: string): string {
    // If it's not a vpub, return as is
    if (!vpub.startsWith('vpub')) return vpub

    // Use the network-aware conversion utility
    return convertKeyFormat(vpub, 'tpub', network)
  }

  // Helper functions for QR code detection and parsing
  const _detectQRType = (data: string) => {
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

  // ... (QR code processing functions would go here, but I'll keep this focused)

  async function pasteFromClipboard() {
    try {
      const clipboardContent = await Clipboard.getStringAsync()
      if (!clipboardContent) {
        toast.error(t('watchonly.error.emptyClipboard'))
        return
      }

      // Process the clipboard content
      const finalContent = clipboardContent.trim()

      if (importType === 'descriptor') {
        let externalDescriptor = finalContent
        let internalDescriptor = ''

        // Try to parse as JSON first
        try {
          const jsonData = JSON.parse(finalContent)

          if (jsonData.descriptor) {
            externalDescriptor = jsonData.descriptor

            // Derive internal descriptor from external descriptor
            // Replace /0/* with /1/* for internal chain and remove checksum
            const descriptorWithoutChecksum = externalDescriptor.replace(
              /#[a-z0-9]+$/,
              ''
            )
            internalDescriptor = descriptorWithoutChecksum.replace(
              /\/0\/\*/g,
              '/1/*'
            )
          }
        } catch (_jsonError) {
          // Handle legacy formats
          if (finalContent.includes('\n')) {
            const lines = finalContent.split('\n')
            externalDescriptor = lines[0].trim()
            internalDescriptor = lines[1].trim()
          }
        }

        // Check if the descriptor is combined (contains <0;1> or <0,1>)
        if (isCombinedDescriptor(finalContent)) {
          // Validate the combined descriptor and get separated descriptors
          const combinedValidation = await validateCombinedDescriptor(
            finalContent,
            scriptVersion as string,
            network as string
          )

          if (combinedValidation.isValid) {
            // For combined descriptors, use format-only validation for the separated descriptors
            // because the checksums are only valid for the full combined descriptor
            await updateExternalDescriptor(
              combinedValidation.externalDescriptor,
              true
            )
            await updateInternalDescriptor(
              combinedValidation.internalDescriptor,
              true
            )
          } else {
            // Set the separated descriptors but mark them as invalid
            setLocalExternalDescriptor(combinedValidation.externalDescriptor)
            setLocalInternalDescriptor(combinedValidation.internalDescriptor)
            setValidExternalDescriptor(false)
            setValidInternalDescriptor(false)
          }
        } else {
          // Handle non-combined descriptors with existing logic
          if (externalDescriptor) {
            updateExternalDescriptor(externalDescriptor)
          }
          if (internalDescriptor) {
            updateInternalDescriptor(internalDescriptor)
          }
        }
      }

      if (importType === 'extendedPub') {
        // Convert vpub to tpub if needed
        const convertedData = convertVpubToTpub(finalContent)
        if (finalContent !== convertedData) {
          toast.info(
            t('watchonly.info.vpubConverted', {
              vpub: finalContent.slice(0, 8) + '...',
              tpub: convertedData.slice(0, 8) + '...'
            })
          )
        }
        updateXpub(convertedData)
      }

      if (importType === 'importAddress') {
        updateAddress(finalContent)
      }

      toast.success(t('watchonly.success.clipboardPasted'))
    } catch (_error) {
      toast.error(t('watchonly.error.clipboardPaste'))
    }
  }

  async function handleNFCRead() {
    if (!isAvailable) {
      toast.error(t('read.nfcNotAvailable'))
      return
    }

    try {
      const result = await readNFCTag()
      if (result) {
        // Process NFC result similar to clipboard
        const finalContent = String(result).trim()

        if (importType === 'descriptor') {
          let externalDescriptor = finalContent
          let internalDescriptor = ''

          // Try to parse as JSON first
          try {
            const jsonData = JSON.parse(finalContent)

            if (jsonData.descriptor) {
              externalDescriptor = jsonData.descriptor

              // Derive internal descriptor from external descriptor
              const descriptorWithoutChecksum = externalDescriptor.replace(
                /#[a-z0-9]+$/,
                ''
              )
              internalDescriptor = descriptorWithoutChecksum.replace(
                /\/0\/\*/g,
                '/1/*'
              )
            }
          } catch (_jsonError) {
            // Handle legacy formats
            if (finalContent.includes('\n')) {
              const lines = finalContent.split('\n')
              externalDescriptor = lines[0].trim()
              internalDescriptor = lines[1].trim()
            }
          }

          // Check if the descriptor is combined (contains <0;1> or <0,1>)
          if (isCombinedDescriptor(finalContent)) {
            // Validate the combined descriptor and get separated descriptors
            const combinedValidation = await validateCombinedDescriptor(
              finalContent,
              scriptVersion as string,
              network as string
            )

            if (combinedValidation.isValid) {
              // For combined descriptors, use format-only validation for the separated descriptors
              // because the checksums are only valid for the full combined descriptor
              await updateExternalDescriptor(
                combinedValidation.externalDescriptor,
                true
              )
              await updateInternalDescriptor(
                combinedValidation.internalDescriptor,
                true
              )
            } else {
              // Set the separated descriptors but mark them as invalid
              setLocalExternalDescriptor(combinedValidation.externalDescriptor)
              setLocalInternalDescriptor(combinedValidation.internalDescriptor)
              setValidExternalDescriptor(false)
              setValidInternalDescriptor(false)
            }
          } else {
            // Handle non-combined descriptors with existing logic
            if (externalDescriptor) {
              updateExternalDescriptor(externalDescriptor)
            }
            if (internalDescriptor) {
              updateInternalDescriptor(internalDescriptor)
            }
          }
        }

        if (importType === 'extendedPub') {
          const convertedData = convertVpubToTpub(finalContent)
          updateXpub(convertedData)
        }

        if (importType === 'importAddress') {
          updateAddress(finalContent)
        }

        toast.success(t('watchonly.success.nfcRead'))
      }
    } catch (_error) {
      toast.error(t('watchonly.error.nfcRead'))
    }
  }

  async function handleQRCodeScanned(data: string | undefined) {
    if (!data) return

    // Process QR code data similar to clipboard
    const finalContent = data.trim()

    if (importType === 'descriptor') {
      let externalDescriptor = finalContent
      let internalDescriptor = ''

      // Try to parse as JSON first
      try {
        const jsonData = JSON.parse(finalContent)

        if (jsonData.descriptor) {
          externalDescriptor = jsonData.descriptor

          // Derive internal descriptor from external descriptor
          const descriptorWithoutChecksum = externalDescriptor.replace(
            /#[a-z0-9]+$/,
            ''
          )
          internalDescriptor = descriptorWithoutChecksum.replace(
            /\/0\/\*/g,
            '/1/*'
          )
        }
      } catch (_jsonError) {
        // Handle legacy formats
        if (finalContent.includes('\n')) {
          const lines = finalContent.split('\n')
          externalDescriptor = lines[0].trim()
          internalDescriptor = lines[1].trim()
        }
      }

      // Check if the descriptor is combined (contains <0;1> or <0,1>)
      if (isCombinedDescriptor(finalContent)) {
        // Validate the combined descriptor and get separated descriptors
        const combinedValidation = await validateCombinedDescriptor(
          finalContent,
          scriptVersion as string,
          network as string
        )

        if (combinedValidation.isValid) {
          // For combined descriptors, use format-only validation for the separated descriptors
          // because the checksums are only valid for the full combined descriptor
          await updateExternalDescriptor(
            combinedValidation.externalDescriptor,
            true
          )
          await updateInternalDescriptor(
            combinedValidation.internalDescriptor,
            true
          )
        } else {
          // Set the separated descriptors but mark them as invalid
          setLocalExternalDescriptor(combinedValidation.externalDescriptor)
          setLocalInternalDescriptor(combinedValidation.internalDescriptor)
          setValidExternalDescriptor(false)
          setValidInternalDescriptor(false)
        }
      } else {
        // Handle non-combined descriptors with existing logic
        if (externalDescriptor) {
          updateExternalDescriptor(externalDescriptor)
        }
        if (internalDescriptor) {
          updateInternalDescriptor(internalDescriptor)
        }
      }
    }

    if (importType === 'extendedPub') {
      const convertedData = convertVpubToTpub(finalContent)
      updateXpub(convertedData)
    }

    if (importType === 'importAddress') {
      updateAddress(finalContent)
    }

    setCameraModalVisible(false)
    toast.success(t('watchonly.success.qrScanned'))
  }

  function handleConfirm() {
    const data: {
      externalDescriptor?: string
      internalDescriptor?: string
      xpub?: string
      fingerprint?: string
    } = {}

    if (importType === 'descriptor') {
      if (externalDescriptor) data.externalDescriptor = externalDescriptor
      if (internalDescriptor) data.internalDescriptor = internalDescriptor
    }

    if (importType === 'extendedPub') {
      if (xpub) data.xpub = xpub
      if (localFingerprint) data.fingerprint = localFingerprint
    }

    onConfirm(data)
  }

  const selectedOption: CreationType =
    importType === 'descriptor' ? 'importDescriptor' : 'importExtendedPub'

  return (
    <SSMainLayout>
      <ScrollView>
        <SSVStack justifyBetween gap="lg" style={{ paddingBottom: 20 }}>
          <SSVStack gap="lg">
            {showDescription && (
              <SSText center color="muted" size="md">
                {t(`watchonly.${selectedOption}.text`)}
              </SSText>
            )}
            <SSVStack gap="sm">
              <SSVStack gap="xxs">
                <SSText center>{t(`watchonly.${selectedOption}.label`)}</SSText>
                {importType === 'extendedPub' && (
                  <SSTextInput
                    value={xpub}
                    style={validXpub ? styles.valid : styles.invalid}
                    onChangeText={updateXpub}
                    multiline
                  />
                )}
                {importType === 'descriptor' && (
                  <SSTextInput
                    value={externalDescriptor}
                    style={
                      validExternalDescriptor ? styles.valid : styles.invalid
                    }
                    onChangeText={updateExternalDescriptor}
                    multiline
                  />
                )}
                {importType === 'importAddress' && (
                  <SSTextInput
                    value={address}
                    style={validAddress ? styles.valid : styles.invalid}
                    onChangeText={updateAddress}
                    multiline
                  />
                )}
              </SSVStack>
              {importType === 'extendedPub' && showFingerprint && (
                <SSVStack gap="xxs">
                  <SSText center>{t('watchonly.fingerprint.label')}</SSText>
                  <SSTextInput
                    value={localFingerprint}
                    onChangeText={updateMasterFingerprint}
                    style={
                      validMasterFingerprint ? styles.valid : styles.invalid
                    }
                  />
                </SSVStack>
              )}
              {importType === 'descriptor' && (
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
              )}
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
          </SSVStack>
          <SSVStack>
            <SSButton
              label={t('common.confirm')}
              variant="secondary"
              disabled={disabled}
              onPress={handleConfirm}
            />
            <SSButton
              label={t('common.cancel')}
              variant="ghost"
              onPress={onCancel}
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

          <SSHStack>
            {!permission?.granted && (
              <SSButton
                label={t('camera.enableCameraAccess')}
                onPress={requestPermission}
              />
            )}
          </SSHStack>
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
