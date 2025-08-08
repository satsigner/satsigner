import { Descriptor } from 'bdk-rn'
import { type Network as BdkNetwork } from 'bdk-rn/lib/lib/enums'
import { CameraView, useCameraPermissions } from 'expo-camera/next'
import * as Clipboard from 'expo-clipboard'
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
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
import { type CreationType, type PolicyType } from '@/types/models/Account'
import { getDerivationPathFromScriptVersion } from '@/utils/bitcoin'
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
  const { isAvailable, isReading, readNFCTag, cancelNFCScan } = useNFCReader()
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [permission, requestPermission] = useCameraPermissions()

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
    const validMasterFingerprint = validateFingerprint(fingerprint)
    setValidMasterFingerprint(!fingerprint || validMasterFingerprint)
    if (importType === 'extendedPub') {
      setDisabled(!validXpub || !fingerprint)
    }
    setLocalFingerprint(fingerprint)
    if (validMasterFingerprint) {
      setFingerprint(fingerprint)
    }
  }

  function updateXpub(xpub: string) {
    const validXpub = validateExtendedKey(xpub, network)
    setValidXpub(!xpub || validXpub)
    if (importType === 'extendedPub') {
      setDisabled(!validXpub || !localFingerprint)
    }
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
        await new Descriptor().create(descriptor, network as BdkNetwork)
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
    if (validExternalDescriptor) {
      setExternalDescriptor(descriptor)
      setExternalDescriptorError('') // Clear error when valid
    }

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
        await new Descriptor().create(descriptor, network as BdkNetwork)
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

  async function confirmKeyImport() {
    if (disabled) return

    setLoadingWallet(true)

    try {
      const creationType: CreationType =
        importType === 'descriptor' ? 'importDescriptor' : 'importExtendedPub'

      setCreationType(creationType)
      setNetwork(network)

      // Set the key data
      const keyIndex = parseInt(index, 10)
      setKey(keyIndex)

      toast.success(t('account.import.success'))
      router.back()
    } catch (error) {
      const errorMessage = (error as Error).message
      if (errorMessage) {
        toast.error(errorMessage)
      } else {
        toast.error(t('account.import.error'))
      }
    } finally {
      setLoadingWallet(false)
    }
  }

  async function pasteFromClipboard() {
    const text = await Clipboard.getStringAsync()
    if (!text) return

    if (importType === 'descriptor') {
      let externalDescriptor = text
      let internalDescriptor = ''

      // Try to parse as JSON first
      try {
        const jsonData = JSON.parse(text)

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
        if (text.includes('\n')) {
          const lines = text.split('\n')
          externalDescriptor = lines[0]
          internalDescriptor = lines[1]
        }
      }

      // Check if the descriptor is combined (contains <0;1> or <0,1>)
      if (isCombinedDescriptor(text)) {
        // Validate the combined descriptor and get separated descriptors
        const combinedValidation = await validateCombinedDescriptor(
          text,
          scriptVersion,
          network
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
        if (externalDescriptor) updateExternalDescriptor(externalDescriptor)
        if (internalDescriptor) updateInternalDescriptor(internalDescriptor)
      }
    }

    if (importType === 'extendedPub') {
      updateXpub(text)
    }
  }

  async function handleNFCRead() {
    if (!isAvailable) {
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
        .replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g, '') // Remove control characters except \n
        .normalize('NFKC') // Normalize unicode characters
        .replace(/^en/, '')

      if (importType === 'descriptor') {
        let externalDescriptor = text
        let internalDescriptor = ''
        if (text.includes('\n')) {
          const lines = text.split('\n')
          externalDescriptor = lines[0]
          internalDescriptor = lines[1]
        }

        // Check if the descriptor is combined (contains <0;1> or <0,1>)
        if (isCombinedDescriptor(text)) {
          // Validate the combined descriptor and get separated descriptors
          const combinedValidation = await validateCombinedDescriptor(
            text,
            scriptVersion,
            network
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
          if (externalDescriptor) updateExternalDescriptor(externalDescriptor)
          if (internalDescriptor) updateInternalDescriptor(internalDescriptor)
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

  async function handleQRCodeScanned(scanningResult: any) {
    const data = scanningResult?.data
    if (!data) return

    // Handle regular QR codes
    if (importType === 'descriptor') {
      let externalDescriptor = data
      let internalDescriptor = ''

      // Try to parse as JSON first
      try {
        const jsonData = JSON.parse(data)
        if (jsonData.descriptor) {
          externalDescriptor = jsonData.descriptor
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
        if (data.includes('\n')) {
          const lines = data.split('\n')
          externalDescriptor = lines[0]
          internalDescriptor = lines[1]
        }
      }

      // Check if the descriptor is combined (contains <0;1> or <0,1>)
      if (isCombinedDescriptor(data)) {
        // Validate the combined descriptor and get separated descriptors
        const combinedValidation = await validateCombinedDescriptor(
          data,
          scriptVersion,
          network
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
        if (externalDescriptor) updateExternalDescriptor(externalDescriptor)
        if (internalDescriptor) updateInternalDescriptor(internalDescriptor)
      }
    }

    if (importType === 'extendedPub') {
      updateXpub(data)
    }

    setCameraModalVisible(false)
  }

  function getImportLabel() {
    if (importType === 'descriptor') {
      return t('watchonly.importDescriptor.title')
    } else {
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
  }

  function getImportDescription() {
    if (importType === 'descriptor') {
      return t('watchonly.importDescriptor.text')
    } else {
      return t('watchonly.importExtendedPub.text')
    }
  }

  if (!name) return <Redirect href="/" />

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{name}</SSText>
        }}
      />
      <ScrollView style={styles.container}>
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
                    />
                    {externalDescriptorError && (
                      <SSText
                        style={{
                          color: Colors.error,
                          fontSize: 12,
                          textAlign: 'center',
                          marginTop: 4
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
                    />
                    {internalDescriptorError && (
                      <SSText
                        style={{
                          color: Colors.error,
                          fontSize: 12,
                          textAlign: 'center',
                          marginTop: 4
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
              variant="ghost"
              onPress={pasteFromClipboard}
            />
            <SSButton
              label={t('watchonly.read.computerVision')}
              variant="ghost"
              onPress={() => setCameraModalVisible(true)}
            />
            {isAvailable && (
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
              onPress={() => router.back()}
            />
          </SSVStack>
        </SSVStack>
      </ScrollView>

      <SSModal
        visible={cameraModalVisible}
        onClose={() => setCameraModalVisible(false)}
      >
        <SSVStack style={styles.cameraContainer}>
          <SSHStack justifyBetween style={styles.cameraHeader}>
            <SSText weight="bold">{t('watchonly.read.computerVision')}</SSText>
            <SSButton
              label={t('common.close')}
              variant="ghost"
              onPress={() => setCameraModalVisible(false)}
            />
          </SSHStack>
          {permission?.granted ? (
            <CameraView
              style={styles.camera}
              onBarcodeScanned={handleQRCodeScanned}
            />
          ) : (
            <SSVStack style={styles.cameraPlaceholder}>
              <SSText center>{t('watchonly.read.cameraPermission')}</SSText>
              <SSButton
                label={t('common.request')}
                onPress={requestPermission}
              />
            </SSVStack>
          )}
        </SSVStack>
      </SSModal>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: Colors.black
  },
  cameraHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[600]
  },
  camera: {
    flex: 1
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  }
})
