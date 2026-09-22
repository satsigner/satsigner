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
import {
  parseImportedDescriptorPayload,
  parseXpubInput
} from '@/utils/descriptor'
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

  useEffect(() => {
    setPolicyType('multisig' as PolicyType)
  }, [setPolicyType])

  function openMainCamera() {
    setScanningFor('main')
    setCameraModalVisible(true)
  }

  function openFingerprintCamera() {
    setScanningFor('fingerprint')
    setCameraModalVisible(true)
  }

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
    const parsed = parseXpubInput(raw)
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

    let networkValidation: { isValid: boolean; error?: string } = {
      isValid: true
    }
    if (basicValidation && descriptor) {
      try {
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

    const isValid = basicValidation && networkValidation.isValid
    const nextValidExternalDescriptor = !descriptor || isValid

    setValidExternalDescriptor(nextValidExternalDescriptor)
    setLocalExternalDescriptor(descriptor)
    if (isValid) {
      setExternalDescriptor(descriptor)
      setExternalDescriptorError('') // Clear error when valid
    }

    updateDescriptorValidationState({
      externalDescriptor: isValid ? descriptor : externalDescriptor,
      validExternalDescriptor: nextValidExternalDescriptor
    })

    return {
      externalDescriptor: isValid ? descriptor : externalDescriptor,
      validExternalDescriptor: nextValidExternalDescriptor
    }
  }

  function updateInternalDescriptor(
    descriptor: string,
    skipChecksumValidation = false
  ) {
    const descriptorValidation = skipChecksumValidation
      ? validateDescriptorFormat(descriptor)
      : validateDescriptor(descriptor)
    const basicValidation = descriptorValidation

    let networkValidation: { isValid: boolean; error?: string } = {
      isValid: true
    }
    if (basicValidation && descriptor) {
      try {
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

    const isValid = basicValidation && networkValidation.isValid
    const nextValidInternalDescriptor = !descriptor || isValid
    setValidInternalDescriptor(nextValidInternalDescriptor)
    setLocalInternalDescriptor(descriptor)
    if (isValid) {
      setInternalDescriptor(descriptor)
      setInternalDescriptorError('') // Clear error when valid
    }

    updateDescriptorValidationState({
      internalDescriptor: isValid ? descriptor : internalDescriptor,
      validInternalDescriptor: nextValidInternalDescriptor
    })

    return {
      internalDescriptor: isValid ? descriptor : internalDescriptor,
      validInternalDescriptor: nextValidInternalDescriptor
    }
  }

  function updateDescriptorValidationState(overrides?: {
    externalDescriptor?: string
    internalDescriptor?: string
    validExternalDescriptor?: boolean
    validInternalDescriptor?: boolean
  }) {
    // Allow import if either external or internal descriptor is valid.
    // Prefer overrides so callers (e.g. QR scan) are not blocked by stale state.
    const nextExternalDescriptor =
      overrides?.externalDescriptor ?? externalDescriptor
    const nextInternalDescriptor =
      overrides?.internalDescriptor ?? internalDescriptor
    const nextValidExternalDescriptor =
      overrides?.validExternalDescriptor ?? validExternalDescriptor
    const nextValidInternalDescriptor =
      overrides?.validInternalDescriptor ?? validInternalDescriptor
    const hasValidExternal =
      nextExternalDescriptor && nextValidExternalDescriptor
    const hasValidInternal =
      nextInternalDescriptor && nextValidInternalDescriptor
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
        if (text.includes('\n')) {
          ;[externalDescriptor, internalDescriptor] = text.split('\n')
        }
      }

      if (isCombinedDescriptor(text)) {
        const combinedValidation = validateCombinedDescriptor(
          text,
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
        if (externalDescriptor) {
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

        if (isCombinedDescriptor(text)) {
          const combinedValidation = validateCombinedDescriptor(
            text,
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
          if (externalDescriptor) {
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
      const parsed = parseImportedDescriptorPayload(content.cleaned)
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
          updateDescriptorValidationState({
            externalDescriptor: combinedValidation.externalDescriptor,
            internalDescriptor: combinedValidation.internalDescriptor,
            validExternalDescriptor: true,
            validInternalDescriptor: true
          })
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
          updateDescriptorValidationState({
            validExternalDescriptor: false,
            validInternalDescriptor: false
          })
        }
      } else {
        const externalValidation = updateExternalDescriptor(
          parsed.external,
          parsed.derivedExternal
        )
        if (parsed.internal) {
          const internalValidation = updateInternalDescriptor(
            parsed.internal,
            parsed.derivedInternal
          )
          updateDescriptorValidationState({
            ...externalValidation,
            ...internalValidation
          })
        } else {
          setLocalInternalDescriptor('')
          setInternalDescriptor('')
          setValidInternalDescriptor(true)
          setInternalDescriptorError('')
          updateDescriptorValidationState({
            ...externalValidation,
            internalDescriptor: '',
            validInternalDescriptor: true
          })
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
                        label={t('common.paste')}
                        variant="subtle"
                        onPress={pasteFingerprintFromClipboard}
                        style={styles.actionButton}
                      />
                      <SSButton
                        label={t('common.scanQR')}
                        variant="subtle"
                        onPress={openFingerprintCamera}
                        style={styles.actionButton}
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
            <SSHStack gap="sm">
              <SSButton
                label={t('common.paste')}
                variant="subtle"
                onPress={pasteFromClipboard}
                style={styles.actionButton}
              />
              <SSButton
                label={t('common.scanQR')}
                variant="subtle"
                onPress={openMainCamera}
                style={styles.actionButton}
              />
              <SSButton
                label={
                  isReading
                    ? t('watchonly.read.scanning')
                    : t('watchonly.read.nfc')
                }
                variant="subtle"
                onPress={handleNFCRead}
                loading={isReading}
                disabled={!isHardwareSupported}
                style={styles.actionButton}
              />
            </SSHStack>
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
  actionButton: {
    flex: 1
  },
  container: {
    flex: 1
  }
})
