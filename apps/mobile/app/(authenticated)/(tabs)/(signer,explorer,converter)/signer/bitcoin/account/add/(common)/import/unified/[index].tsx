import * as Clipboard from 'expo-clipboard'
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { StyleSheet } from 'react-native'
import { walletNameFromDescriptor } from 'react-native-bdk-sdk'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { UNKNOWN_MASTER_FINGERPRINT } from '@/constants/btc'
import { useNFCReader } from '@/hooks/useNFCReader'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import { type CreationType, type PolicyType } from '@/types/models/Account'
import {
  appNetworkToBdkNetwork,
  getDerivationPathFromScriptVersion
} from '@/utils/bitcoin'
import { type DetectedContent } from '@/utils/contentDetector'
import { DescriptorUtils } from '@/utils/descriptorUtils'
import {
  isCombinedDescriptor,
  validateCombinedDescriptor,
  validateDescriptor,
  validateDescriptorFormat,
  validateExtendedKey,
  validateFingerprint
} from '@/utils/validation'

type UnifiedImportSearchParams = {
  index: string
  importType: 'descriptor' | 'extendedPub'
}

export default function UnifiedImport() {
  const { index, importType } =
    useLocalSearchParams<UnifiedImportSearchParams>()
  const [
    name,
    scriptVersion,
    fingerprint,
    setCreationType,
    setFingerprint,
    setExternalDescriptor,
    setInternalDescriptor,
    setExtendedPublicKey,
    setKey,
    setNetwork,
    setPolicyType
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.name,
      state.scriptVersion,
      state.fingerprint,
      state.setCreationType,
      state.setFingerprint,
      state.setExternalDescriptor,
      state.setInternalDescriptor,
      state.setExtendedPublicKey,
      state.setKey,
      state.setNetwork,
      state.setPolicyType
    ])
  )
  const network = useBlockchainStore((state) => state.selectedNetwork)
  const { isHardwareSupported, isReading, readNFCTag, cancelNFCScan } =
    useNFCReader()
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [scanningFor, setScanningFor] = useState<'main' | 'fingerprint'>('main')

  const [xpub, setXpub] = useState('')
  const [localFingerprint, setLocalFingerprint] = useState(fingerprint)
  const [externalDescriptor, setLocalExternalDescriptor] = useState('')
  const [internalDescriptor, setLocalInternalDescriptor] = useState('')

  const [disabled, setDisabled] = useState(true)
  const [validExternalDescriptor, setValidExternalDescriptor] = useState(true)
  const [validInternalDescriptor, setValidInternalDescriptor] = useState(true)
  const [validXpub, setValidXpub] = useState(true)
  const [_validMasterFingerprint, setValidMasterFingerprint] = useState(true)
  const [externalDescriptorError, setExternalDescriptorError] = useState('')
  const [internalDescriptorError, setInternalDescriptorError] = useState('')

  const [loadingWallet, setLoadingWallet] = useState(false)

  // Set policy type to multisig when component mounts
  useEffect(() => {
    setPolicyType('multisig' as PolicyType)
  }, [setPolicyType])

  function updateMasterFingerprint(fingerprint: string) {
    const validMasterFingerprint =
      !fingerprint || validateFingerprint(fingerprint)
    setValidMasterFingerprint(validMasterFingerprint)
    if (importType === 'extendedPub') {
      setDisabled(!validXpub || !validMasterFingerprint)
    }
    setLocalFingerprint(fingerprint)
    if (fingerprint && validateFingerprint(fingerprint)) {
      setFingerprint(fingerprint)
    }
  }

  function updateXpub(raw: string) {
    const parsed = DescriptorUtils.parseXpubInput(raw)
    const nextXpub = parsed.xpub
    const validXpub = validateExtendedKey(nextXpub, network)
    const nextFingerprint = parsed.fingerprint || localFingerprint
    const validFingerprint =
      !nextFingerprint || validateFingerprint(nextFingerprint)
    setValidXpub(!nextXpub || validXpub)
    if (importType === 'extendedPub') {
      setDisabled(!validXpub || !validFingerprint)
    }
    setXpub(nextXpub)

    if (parsed.fingerprint) {
      setLocalFingerprint(parsed.fingerprint)
      setFingerprint(parsed.fingerprint)
      setValidMasterFingerprint(true)
    }

    const fingerprintForDescriptor =
      nextFingerprint || UNKNOWN_MASTER_FINGERPRINT
    if (validXpub) {
      const derivationPath = getDerivationPathFromScriptVersion(
        scriptVersion,
        network
      )
      const formattedXpub = `[${fingerprintForDescriptor}/${derivationPath}]${nextXpub}/0/*`
      setExtendedPublicKey(formattedXpub)
    }
  }

  function updateExternalDescriptor(
    descriptor: string,
    skipChecksumValidation = false
  ) {
    const descriptorValidation = skipChecksumValidation
      ? validateDescriptorFormat(descriptor)
      : validateDescriptor(descriptor)
    const basicValidation =
      descriptorValidation && !descriptor.match(/[txyz]priv/)

    // Network validation - check if descriptor is compatible with selected network
    let networkValidation: { isValid: boolean; error?: string } = {
      isValid: true
    }
    if (basicValidation && descriptor) {
      try {
        // Try to validate descriptor with BDK to check network compatibility
        walletNameFromDescriptor(
          descriptor,
          undefined,
          appNetworkToBdkNetwork(network)
        )
        networkValidation = { isValid: true }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        networkValidation =
          errorMessage.includes('Invalid network') ||
          errorMessage.includes('network')
            ? {
                error: 'networkIncompatible' as const,
                isValid: false
              }
            : { isValid: true }
      }
    }

    const validExternalDescriptor = basicValidation && networkValidation.isValid

    setValidExternalDescriptor(!descriptor || validExternalDescriptor)
    setLocalExternalDescriptor(descriptor)
    if (validExternalDescriptor) {
      setExternalDescriptor(descriptor)
      setExternalDescriptorError('') // Clear error when valid
    }

    // Update disabled state based on both external and internal descriptors
    updateDescriptorValidationState()
  }

  function updateInternalDescriptor(
    descriptor: string,
    skipChecksumValidation = false
  ) {
    const descriptorValidation = skipChecksumValidation
      ? validateDescriptorFormat(descriptor)
      : validateDescriptor(descriptor)
    const basicValidation = descriptorValidation

    // Network validation - check if descriptor is compatible with selected network
    let networkValidation: { isValid: boolean; error?: string } = {
      isValid: true
    }
    if (basicValidation && descriptor) {
      try {
        // Try to validate descriptor with BDK to check network compatibility
        walletNameFromDescriptor(
          descriptor,
          undefined,
          appNetworkToBdkNetwork(network)
        )
        networkValidation = { isValid: true }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        networkValidation =
          errorMessage.includes('Invalid network') ||
          errorMessage.includes('network')
            ? {
                error: 'networkIncompatible' as const,
                isValid: false
              }
            : { isValid: true }
      }
    }

    const validInternalDescriptor = basicValidation && networkValidation.isValid
    setValidInternalDescriptor(!descriptor || validInternalDescriptor)
    setLocalInternalDescriptor(descriptor)
    if (validInternalDescriptor) {
      setInternalDescriptor(descriptor)
      setInternalDescriptorError('') // Clear error when valid
    }

    // Update disabled state based on both external and internal descriptors
    updateDescriptorValidationState()
  }

  function updateDescriptorValidationState() {
    // Allow import if either external or internal descriptor is valid
    // At least one descriptor must be provided and valid
    const hasValidExternal = externalDescriptor && validExternalDescriptor
    const hasValidInternal = internalDescriptor && validInternalDescriptor
    const hasAnyValidDescriptor = hasValidExternal || hasValidInternal

    if (importType === 'descriptor') {
      setDisabled(!hasAnyValidDescriptor)
    }
  }

  function confirmKeyImport() {
    if (disabled) {
      return
    }

    setLoadingWallet(true)

    try {
      const creationType: CreationType =
        importType === 'descriptor' ? 'importDescriptor' : 'importExtendedPub'

      setCreationType(creationType)
      setNetwork(network)
      if (importType === 'extendedPub') {
        setFingerprint(localFingerprint || UNKNOWN_MASTER_FINGERPRINT)
      }

      // Set the key data
      const keyIndex = parseInt(index!, 10)
      setKey(keyIndex)

      toast.success(t('account.import.success'))
      router.back()
    } catch (error) {
      const errorMessage = (error as Error).message
      if (errorMessage) {
        toast.error(errorMessage)
      } else {
        toast.error(t('account.import.error.generic'))
      }
    } finally {
      setLoadingWallet(false)
    }
  }

  async function pasteFromClipboard() {
    const text = await Clipboard.getStringAsync()
    if (!text) {
      return
    }

    if (importType === 'descriptor') {
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
          // Replace /0/* with /1/* for internal chain and remove checksum
          const descriptorWithoutChecksum = originalDescriptor.replace(
            /#[a-z0-9]+$/,
            ''
          )
          internalDescriptor = descriptorWithoutChecksum.replace(
            /\/0\/\*/g,
            '/1/*'
          )
        }
      } catch {
        // Handle legacy formats
        if (text.includes('\n')) {
          ;[externalDescriptor, internalDescriptor] = text.split('\n')
        }
      }

      // Check if the descriptor is combined (contains <0;1> or <0,1>)
      if (isCombinedDescriptor(text)) {
        // Validate the combined descriptor and get separated descriptors
        const combinedValidation = validateCombinedDescriptor(
          text,
          scriptVersion,
          network as string
        )

        if (combinedValidation.isValid) {
          // Set both descriptors and mark them as valid
          setLocalExternalDescriptor(combinedValidation.externalDescriptor)
          setLocalInternalDescriptor(combinedValidation.internalDescriptor)
          setValidExternalDescriptor(true)
          setValidInternalDescriptor(true)

          // Store the descriptors in the store
          setExternalDescriptor(combinedValidation.externalDescriptor)
          setInternalDescriptor(combinedValidation.internalDescriptor)

          // Clear any error messages
          setExternalDescriptorError('')
          setInternalDescriptorError('')
        } else {
          // Set the separated descriptors but mark them as invalid
          setLocalExternalDescriptor(combinedValidation.externalDescriptor)
          setLocalInternalDescriptor(combinedValidation.internalDescriptor)
          setValidExternalDescriptor(false)
          setValidInternalDescriptor(false)

          // Show the error message for both fields
          const errorMessage = combinedValidation.error
            ? t(`account.import.error.${combinedValidation.error}`)
            : t('account.import.error.descriptorFormat')
          setExternalDescriptorError(errorMessage)
          setInternalDescriptorError(errorMessage)
        }
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

    if (importType === 'extendedPub') {
      updateXpub(text)
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
    } catch {
      toast.error(t('watchonly.error.clipboardPaste'))
    }
  }

  async function handleNFCRead() {
    if (!isHardwareSupported) {
      toast.error(t('watchonly.read.nfcNotAvailable'))
      return
    }

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

      if (importType === 'descriptor') {
        let externalDescriptor = text
        let internalDescriptor = ''
        const originalDescriptor = ''
        if (text.includes('\n')) {
          ;[externalDescriptor, internalDescriptor] = text.split('\n')
        }

        // Check if the descriptor is combined (contains <0;1> or <0,1>)
        if (isCombinedDescriptor(text)) {
          // Validate the combined descriptor and get separated descriptors
          const combinedValidation = validateCombinedDescriptor(
            text,
            scriptVersion,
            network as string
          )

          if (combinedValidation.isValid) {
            // Set both descriptors and mark them as valid
            setLocalExternalDescriptor(combinedValidation.externalDescriptor)
            setLocalInternalDescriptor(combinedValidation.internalDescriptor)
            setValidExternalDescriptor(true)
            setValidInternalDescriptor(true)

            // Store the descriptors in the store
            setExternalDescriptor(combinedValidation.externalDescriptor)
            setInternalDescriptor(combinedValidation.internalDescriptor)

            // Clear any error messages
            setExternalDescriptorError('')
            setInternalDescriptorError('')
          } else {
            // Set the separated descriptors but mark them as invalid
            setLocalExternalDescriptor(combinedValidation.externalDescriptor)
            setLocalInternalDescriptor(combinedValidation.internalDescriptor)
            setValidExternalDescriptor(false)
            setValidInternalDescriptor(false)

            // Show the error message for both fields
            const errorMessage = combinedValidation.error
              ? t(`account.import.error.${combinedValidation.error}`)
              : t('account.import.error.descriptorFormat')
            setExternalDescriptorError(errorMessage)
            setInternalDescriptorError(errorMessage)
          }
        } else {
          // Handle non-combined descriptors with existing logic
          if (externalDescriptor) {
            // For JSON descriptors, use the original descriptor for validation
            const descriptorToValidate =
              originalDescriptor || externalDescriptor
            updateExternalDescriptor(descriptorToValidate)
          }
          if (internalDescriptor) {
            updateInternalDescriptor(internalDescriptor)
          }
        }
      }

      if (importType === 'extendedPub') {
        updateXpub(text)
      }
    } catch (error) {
      const errorMessage = (error as Error).message
      if (errorMessage) {
        toast.error(errorMessage)
      }
    }
  }

  function handleContentScanned(content: DetectedContent) {
    if (
      scanningFor === 'fingerprint' ||
      content.type === 'master_fingerprint'
    ) {
      if (!validateFingerprint(content.cleaned)) {
        toast.error(t('account.import.error.fingerprintFormat'))
        return
      }
      updateMasterFingerprint(content.cleaned)
      toast.success(t('watchonly.success.qrScanned'))
      return
    }
    if (importType === 'descriptor' && content.type === 'bitcoin_descriptor') {
      const parsed = DescriptorUtils.parseImportedDescriptorPayload(
        content.cleaned
      )
      if (!parsed) {
        toast.error(t('account.import.error.descriptorFormat'))
        return
      }
      if (parsed.combined) {
        const combinedValidation = validateCombinedDescriptor(
          parsed.combined,
          scriptVersion,
          network as string
        )
        if (combinedValidation.isValid) {
          setLocalExternalDescriptor(combinedValidation.externalDescriptor)
          setLocalInternalDescriptor(combinedValidation.internalDescriptor)
          setValidExternalDescriptor(true)
          setValidInternalDescriptor(true)
          setExternalDescriptor(combinedValidation.externalDescriptor)
          setInternalDescriptor(combinedValidation.internalDescriptor)
          setExternalDescriptorError('')
          setInternalDescriptorError('')
        } else {
          setLocalExternalDescriptor(combinedValidation.externalDescriptor)
          setLocalInternalDescriptor(combinedValidation.internalDescriptor)
          setValidExternalDescriptor(false)
          setValidInternalDescriptor(false)
          const errorMessage = combinedValidation.error
            ? t(`account.import.error.${combinedValidation.error}`)
            : t('account.import.error.descriptorFormat')
          setExternalDescriptorError(errorMessage)
          setInternalDescriptorError(errorMessage)
        }
      } else {
        updateExternalDescriptor(parsed.external, parsed.derivedExternal)
        if (parsed.internal) {
          updateInternalDescriptor(parsed.internal, parsed.derivedInternal)
        }
      }
      toast.success(t('watchonly.success.qrScanned'))
      return
    }
    if (
      importType === 'extendedPub' &&
      (content.type === 'extended_public_key' ||
        content.type === 'bitcoin_descriptor')
    ) {
      updateXpub(content.cleaned)
      toast.success(t('watchonly.success.qrScanned'))
    }
  }

  function getImportLabel() {
    if (importType === 'descriptor') {
      return t('watchonly.importDescriptor.title')
    }
    // Return the appropriate label based on script version
    switch (scriptVersion) {
      case 'P2PKH':
        return t('account.import.xpub')
      case 'P2SH-P2WPKH':
        return t('account.import.ypub')
      case 'P2WPKH':
        return t('account.import.zpub')
      case 'P2TR':
        return t('account.import.vpub')
      default:
        return t('account.import.xpub')
    }
  }

  function getImportDescription() {
    if (importType === 'descriptor') {
      return t('watchonly.importDescriptor.text')
    }
    return t('watchonly.importExtendedPub.text')
  }

  if (!name) {
    return <Redirect href="/" />
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{name}</SSText>
        }}
      />
      <SSScrollView style={styles.container}>
        <SSVStack justifyBetween style={{ flex: 1 }}>
          <SSVStack>
            <SSFormLayout>
              <SSFormLayout.Item>
                <SSFormLayout.Label label={getImportLabel()} />
                <SSText color="muted" size="md">
                  {getImportDescription()}
                </SSText>
              </SSFormLayout.Item>

              {importType === 'extendedPub' && (
                <>
                  <SSFormLayout.Item>
                    <SSFormLayout.Label
                      label={t('watchonly.importExtendedPub.label')}
                    />
                    <SSTextInput
                      value={xpub}
                      onChangeText={updateXpub}
                      placeholder={t('watchonly.importExtendedPub.label')}
                    />
                  </SSFormLayout.Item>
                  <SSFormLayout.Item>
                    <SSFormLayout.Label
                      label={t('watchonly.fingerprint.label')}
                    />
                    <SSTextInput
                      value={localFingerprint}
                      onChangeText={updateMasterFingerprint}
                      placeholder={t('watchonly.fingerprint.text')}
                    />
                    <SSHStack gap="sm" style={{ marginTop: 8 }}>
                      <SSButton
                        label={t('watchonly.read.clipboard')}
                        variant="subtle"
                        onPress={pasteFingerprintFromClipboard}
                        style={{ flex: 1 }}
                      />
                      <SSButton
                        label={t('watchonly.read.qrcode')}
                        variant="subtle"
                        onPress={() => {
                          setScanningFor('fingerprint')
                          setCameraModalVisible(true)
                        }}
                        style={{ flex: 1 }}
                      />
                    </SSHStack>
                  </SSFormLayout.Item>
                </>
              )}

              {importType === 'descriptor' && (
                <>
                  <SSFormLayout.Item>
                    <SSFormLayout.Label
                      label={t('watchonly.importDescriptor.external')}
                    />
                    <SSTextInput
                      value={externalDescriptor}
                      onChangeText={updateExternalDescriptor}
                      placeholder={t('watchonly.importDescriptor.external')}
                      multiline
                      numberOfLines={3}
                      status={externalDescriptorError ? 'invalid' : undefined}
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
                  </SSFormLayout.Item>
                  <SSFormLayout.Item>
                    <SSFormLayout.Label
                      label={t('watchonly.importDescriptor.internal')}
                    />
                    <SSTextInput
                      value={internalDescriptor}
                      onChangeText={updateInternalDescriptor}
                      placeholder={t('watchonly.importDescriptor.internal')}
                      multiline
                      numberOfLines={3}
                      status={internalDescriptorError ? 'invalid' : undefined}
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
                  </SSFormLayout.Item>
                </>
              )}
            </SSFormLayout>
          </SSVStack>

          <SSVStack>
            <SSButton
              label={t('watchonly.read.clipboard')}
              variant="subtle"
              onPress={pasteFromClipboard}
            />
            <SSButton
              label={t('watchonly.read.computerVision')}
              variant="subtle"
              onPress={() => {
                setScanningFor('main')
                setCameraModalVisible(true)
              }}
            />
            {isHardwareSupported && (
              <SSButton
                label={t('watchonly.read.nfc')}
                variant="ghost"
                onPress={handleNFCRead}
                loading={isReading}
              />
            )}
            <SSButton
              label={t('common.confirm')}
              variant="secondary"
              disabled={disabled}
              loading={loadingWallet}
              onPress={confirmKeyImport}
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
        onClose={() => {
          setCameraModalVisible(false)
          setScanningFor('main')
        }}
        onContentScanned={handleContentScanned}
        context="bitcoin"
      />
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  }
})
