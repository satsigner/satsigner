import * as Clipboard from 'expo-clipboard'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { type Network as _Network } from 'react-native-bdk-sdk'
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { UNKNOWN_MASTER_FINGERPRINT } from '@/constants/btc'
import { useNFCReader } from '@/hooks/useNFCReader'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import { type ScriptVersionType } from '@/types/models/Script'
import { type ImportDescriptorSearchParams } from '@/types/navigation/searchParams'
import {
  getDerivationPathFromScriptVersion,
  getMultisigDerivationPathFromScriptVersion
} from '@/utils/bitcoin'
import { type DetectedContent } from '@/utils/contentDetector'
import { DescriptorUtils } from '@/utils/descriptorUtils'
import {
  isCombinedDescriptor,
  validateCombinedDescriptor,
  validateDescriptor,
  validateDescriptorFormat,
  validateDescriptorScriptVersion
} from '@/utils/validation'

export default function ImportDescriptor() {
  const { keyIndex } = useLocalSearchParams<ImportDescriptorSearchParams>()
  const router = useRouter()
  const network = useBlockchainStore((state) => state.selectedNetwork)

  const { isHardwareSupported, isReading, readNFCTag, cancelNFCScan } =
    useNFCReader()
  const [cameraModalVisible, setCameraModalVisible] = useState(false)

  // State for import data
  const [externalDescriptor, setExternalDescriptor] = useState('')
  const [internalDescriptor, setInternalDescriptor] = useState('')

  // Validation state
  const [disabled, setDisabled] = useState(true)
  const [validExternalDescriptor, setValidExternalDescriptor] = useState(true)
  const [validInternalDescriptor, setValidInternalDescriptor] = useState(true)
  const [externalDescriptorError, setExternalDescriptorError] = useState('')
  const [internalDescriptorError, setInternalDescriptorError] = useState('')

  const pulseAnim = useSharedValue(0)
  const scaleAnim = useSharedValue(1)

  useEffect(() => {
    if (isReading) {
      pulseAnim.set(
        withRepeat(
          withSequence(
            withTiming(1, { duration: 500 }),
            withTiming(0, { duration: 500 })
          ),
          -1
        )
      )
      return () => {
        cancelAnimation(pulseAnim)
      }
    }
  }, [isReading, pulseAnim])

  const nfcButtonStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulseAnim.value, [0, 1], [1, 0.7]),
    overflow: 'hidden' as const,
    transform: [{ scale: scaleAnim.value }]
  }))

  const [
    setExtendedPublicKey,
    setStoreExternalDescriptor,
    setStoreInternalDescriptor,
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
      state.setExternalDescriptor,
      state.setInternalDescriptor,
      state.setFingerprint,
      state.clearKeyState,
      state.setKey,
      state.setKeyDerivationPath,
      state.policyType,
      state.scriptVersion,
      state.network
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

  function updateExternalDescriptor(
    descriptor: string,
    skipChecksumValidation = false
  ) {
    // Basic descriptor validation
    const descriptorValidation = skipChecksumValidation
      ? validateDescriptorFormat(descriptor)
      : validateDescriptor(descriptor)
    const basicValidation =
      descriptorValidation && !descriptor.match(/[txyz]priv/)

    // Network validation - check if descriptor is compatible with selected network
    // Skip network validation during confirm stage since it was already validated during input
    const networkValidation: { isValid: boolean; error?: string } = {
      isValid: true
    }

    // Script version validation for multisig
    let scriptVersionValidation = true
    if (basicValidation && scriptVersion) {
      scriptVersionValidation = validateDescriptorScriptVersion(
        descriptor,
        scriptVersion
      )
    }
    const validExternalDescriptor =
      basicValidation && networkValidation.isValid && scriptVersionValidation

    setValidExternalDescriptor(!descriptor || validExternalDescriptor)
    setExternalDescriptor(descriptor)

    // Clear previous error first
    setExternalDescriptorError('')

    // Show error message if validation fails
    if (descriptor) {
      if (!basicValidation) {
        const errorMessage = t('account.import.error.descriptorFormat')
        setExternalDescriptorError(errorMessage)
      } else if (basicValidation && !networkValidation.isValid) {
        // Show error for network validation failures
        const errorMessage = networkValidation.error
          ? t(`account.import.error.${networkValidation.error}`)
          : t('account.import.error.networkIncompatible')
        setExternalDescriptorError(errorMessage)
      } else if (basicValidation && !scriptVersionValidation) {
        const errorMessage = t('account.import.error.descriptorIncompatible')
        setExternalDescriptorError(errorMessage)
      }
    }

    if (validExternalDescriptor) {
      setStoreExternalDescriptor(descriptor)
    }
  }

  function updateInternalDescriptor(
    descriptor: string,
    skipChecksumValidation = false
  ) {
    // Basic descriptor validation
    const descriptorValidation = skipChecksumValidation
      ? validateDescriptorFormat(descriptor)
      : validateDescriptor(descriptor)
    const basicValidation = descriptorValidation

    // Network validation - check if descriptor is compatible with selected network
    // Skip network validation during confirm stage since it was already validated during input
    const networkValidation: { isValid: boolean; error?: string } = {
      isValid: true
    }

    // Script version validation for multisig
    let scriptVersionValidation = true
    if (basicValidation && scriptVersion) {
      scriptVersionValidation = validateDescriptorScriptVersion(
        descriptor,
        scriptVersion
      )
    }

    const validInternalDescriptor =
      basicValidation && networkValidation.isValid && scriptVersionValidation

    setValidInternalDescriptor(!descriptor || validInternalDescriptor)
    setInternalDescriptor(descriptor)

    // Clear previous error first
    setInternalDescriptorError('')

    // Show error message if validation fails
    if (descriptor) {
      if (!basicValidation) {
        // Show error for basic validation failures
        const errorMessage = t('account.import.error.descriptorFormat')
        setInternalDescriptorError(errorMessage)
      } else if (basicValidation && !networkValidation.isValid) {
        // Show error for network validation failures
        const errorMessage = networkValidation.error
          ? t(`account.import.error.${networkValidation.error}`)
          : t('account.import.error.networkIncompatible')
        setInternalDescriptorError(errorMessage)
      } else if (basicValidation && !scriptVersionValidation) {
        // Show error for script version validation failures
        const errorMessage = t('account.import.error.descriptorIncompatible')
        setInternalDescriptorError(errorMessage)
      }
    }

    if (validInternalDescriptor) {
      setStoreInternalDescriptor(descriptor)
    }
  }

  function handleConfirm() {
    try {
      // Extract fingerprint from the descriptor if possible
      const fingerprint = extractFingerprintFromDescriptor(externalDescriptor)

      // Extract extended public key and derivation path
      const { extendedPublicKey, derivationPath } =
        extractDescriptorInfo(externalDescriptor)

      if (!extendedPublicKey) {
        toast.error(t('account.import.error.descriptorFormat'))
        return
      }

      // Set the descriptors in the store
      setStoreExternalDescriptor(externalDescriptor)
      if (internalDescriptor.trim()) {
        setStoreInternalDescriptor(internalDescriptor)
      }

      // Set the extracted information in the store
      setExtendedPublicKey(extendedPublicKey)
      setFingerprint(fingerprint || UNKNOWN_MASTER_FINGERPRINT)

      // Set the key data
      setKey(Number(keyIndex))
      setKeyDerivationPath(Number(keyIndex), derivationPath)
      clearKeyState()
      router.dismiss(1)
    } catch {
      toast.error(t('account.import.error.generic'))
    }
  }

  function extractFingerprintFromDescriptor(descriptor: string) {
    return DescriptorUtils.extractFingerprint(descriptor)
  }

  function extractDescriptorInfo(descriptor: string) {
    // Extract extended public key using regex
    const xpubMatch = descriptor.match(/(tpub|xpub|vpub|zpub)[A-Za-z0-9]+/)
    const extendedPublicKey = xpubMatch ? xpubMatch[0] : ''

    // Extract derivation path with improved logic
    const derivationPath = extractDerivationPathFromDescriptor(descriptor)

    return { derivationPath, extendedPublicKey }
  }

  function extractDerivationPathFromDescriptor(descriptor: string) {
    // Primary method: Extract from [fingerprint/derivation] pattern
    // Look for the pattern: [fingerprint/derivation] where derivation contains slashes
    const bracketMatch = descriptor.match(
      /\[([0-9a-fA-F]{8})\/([0-9]+[h']?\/)*[0-9]+[h']?\]/
    )

    if (bracketMatch) {
      // Extract the full derivation path by removing fingerprint and brackets
      const [fullBracket] = bracketMatch
      const derivationPath = fullBracket
        .replace(/^\[[0-9a-fA-F]{8}\//, '') // Remove [fingerprint/
        .replace(/\]$/, '') // Remove closing ]

      // Add 'm/' prefix if not present
      if (!derivationPath.startsWith('m/')) {
        return `m/${derivationPath}`
      }

      return derivationPath
    }

    // Secondary method: Extract from /derivation/* pattern
    const pathMatch = descriptor.match(/\/([0-9]+[h']?\/)*[0-9]+[h']?\/\*/)
    if (pathMatch) {
      return `m/${pathMatch[0].replace(/\/\*$/, '')}`
    }

    // Fallback: Use default derivation path
    return getDefaultDerivationPath()
  }

  function handleCombinedDescriptorImport(combinedDescriptor: string) {
    try {
      // Validate the combined descriptor and get separated descriptors
      const combinedValidation = validateCombinedDescriptor(
        combinedDescriptor,
        scriptVersion as ScriptVersionType,
        network as string
      )

      if (combinedValidation.isValid) {
        // For combined descriptors, use format-only validation for the separated descriptors
        // because the checksums are only valid for the full combined descriptor
        updateExternalDescriptor(combinedValidation.externalDescriptor, true)
        updateInternalDescriptor(combinedValidation.internalDescriptor, true)
      } else {
        // Set the separated descriptors but mark them as invalid
        setExternalDescriptor(combinedValidation.externalDescriptor)
        setInternalDescriptor(combinedValidation.internalDescriptor)
        setValidExternalDescriptor(false)
        setValidInternalDescriptor(false)

        // Show the error message for both fields
        const errorMessage = combinedValidation.error
          ? t(`account.import.error.${combinedValidation.error}`)
          : t('account.import.error.descriptorFormat')
        setExternalDescriptorError(errorMessage)
        setInternalDescriptorError(errorMessage)
      }
    } catch {
      toast.error(t('account.import.error.generic'))
    }
  }

  async function pasteFromClipboard() {
    const text = await Clipboard.getStringAsync()

    if (!text) {
      return
    }

    let externalDescriptor = text
    let internalDescriptor = ''

    // Try to parse as JSON first
    let originalDescriptor = ''
    try {
      const jsonData = JSON.parse(text)

      if (jsonData.descriptor) {
        originalDescriptor = jsonData.descriptor
        externalDescriptor = originalDescriptor

        // Derive internal descriptor from external descriptor
        // Replace /0/* with /1/* for internal chain
        const descriptorWithoutChecksum = originalDescriptor.replace(
          /#[a-z0-9]+$/,
          ''
        )
        internalDescriptor = descriptorWithoutChecksum.replace(
          /\/0\/\*/g,
          '/1/*'
        )
        // Add back the checksum to internal descriptor
        const checksum = originalDescriptor.match(/#[a-z0-9]+$/)
        if (checksum) {
          internalDescriptor += checksum[0]
        }
      }
    } catch {
      // Handle legacy formats
      if (text.includes('\n')) {
        ;[externalDescriptor, internalDescriptor] = text.split('\n')
      }
    }

    // Handle combined descriptors with smart validation
    if (isCombinedDescriptor(text)) {
      handleCombinedDescriptorImport(text)
    } else {
      // Handle non-combined descriptors with existing logic
      if (externalDescriptor) {
        // For JSON descriptors, use the original descriptor for validation
        const descriptorToValidate = originalDescriptor || externalDescriptor
        updateExternalDescriptor(descriptorToValidate)
      }
      if (internalDescriptor) {
        updateInternalDescriptor(internalDescriptor)
      }
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
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g, '') // Remove control characters except \n
        .normalize('NFKC') // Normalize unicode characters
        .replace(/^en/, '')

      let externalDescriptor = text
      let internalDescriptor = ''
      if (text.includes('\n')) {
        ;[externalDescriptor, internalDescriptor] = text.split('\n')
      }

      // Handle combined descriptors with smart validation
      if (isCombinedDescriptor(text)) {
        handleCombinedDescriptorImport(text)
      } else {
        // Handle non-combined descriptors with existing logic
        if (externalDescriptor) {
          updateExternalDescriptor(externalDescriptor)
        }
        if (internalDescriptor) {
          updateInternalDescriptor(internalDescriptor)
        }
      }

      toast.success(t('watchonly.success.nfcRead'))
    } catch {
      toast.error(t('watchonly.error.nfcRead'))
    }
  }

  function handleContentScanned(content: DetectedContent) {
    if (content.type === 'bitcoin_descriptor') {
      if (content.metadata?.isCombined) {
        handleCombinedDescriptorImport(content.cleaned)
      } else {
        updateExternalDescriptor(content.cleaned)
      }
      toast.success(t('watchonly.success.qrScanned'))
      return
    }
    toast.error(t('account.import.error.descriptorFormat'))
  }

  function getDefaultDerivationPath(): string {
    // Check if we're in multisig mode to use the correct derivation path function
    const rawDerivationPath =
      policyType === 'multisig'
        ? getMultisigDerivationPathFromScriptVersion(
            scriptVersion,
            builderNetwork
          )
        : getDerivationPathFromScriptVersion(scriptVersion, builderNetwork)

    return `m/${rawDerivationPath}`
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('account.import.descriptor')}</SSText>
          )
        }}
      />
      <SSScrollView>
        <SSVStack justifyBetween gap="lg" style={{ paddingBottom: 20 }}>
          <SSVStack gap="lg">
            <SSVStack gap="sm">
              <SSVStack gap="xxs">
                <SSText center>{t('watchonly.importDescriptor.label')}</SSText>
                <SSTextInput
                  value={externalDescriptor}
                  style={{ height: 'auto', paddingVertical: 10 }}
                  status={
                    !externalDescriptor
                      ? undefined
                      : validExternalDescriptor
                        ? 'valid'
                        : 'invalid'
                  }
                  onChangeText={updateExternalDescriptor}
                  multiline
                />
                {externalDescriptorError && (
                  <SSText
                    style={{
                      color: Colors.error,
                      fontSize: 12,
                      marginTop: 4,
                      textAlign: 'center'
                    }}
                  >
                    {externalDescriptorError}
                  </SSText>
                )}
              </SSVStack>
              <SSVStack gap="xxs">
                <SSText center>
                  {t('watchonly.importDescriptor.internal')}
                </SSText>
                <SSTextInput
                  value={internalDescriptor}
                  style={{ height: 'auto', paddingVertical: 10 }}
                  status={
                    !internalDescriptor
                      ? undefined
                      : validInternalDescriptor
                        ? 'valid'
                        : 'invalid'
                  }
                  multiline
                  onChangeText={updateInternalDescriptor}
                />
                {internalDescriptorError && (
                  <SSText
                    style={{
                      color: Colors.error,
                      fontSize: 12,
                      marginTop: 4,
                      textAlign: 'center'
                    }}
                  >
                    {internalDescriptorError}
                  </SSText>
                )}
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
              <Animated.View style={nfcButtonStyle}>
                <SSButton
                  label={
                    isReading
                      ? t('watchonly.read.scanning')
                      : t('watchonly.read.nfc')
                  }
                  onPress={handleNFCRead}
                  disabled={!isHardwareSupported}
                />
              </Animated.View>
            </SSVStack>
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
              onPress={() => router.dismiss(1)}
            />
          </SSVStack>
        </SSVStack>
      </SSScrollView>

      <SSCameraModal
        visible={cameraModalVisible}
        onClose={() => setCameraModalVisible(false)}
        onContentScanned={handleContentScanned}
        context="bitcoin"
      />
    </SSMainLayout>
  )
}
