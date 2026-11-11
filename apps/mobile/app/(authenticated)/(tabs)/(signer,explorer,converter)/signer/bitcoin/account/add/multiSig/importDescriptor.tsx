import * as Clipboard from 'expo-clipboard'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useNFCReader } from '@/hooks/useNFCReader'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { Colors } from '@/styles'
import { type NFCReadResult } from '@/types/models/Nfc'
import { type DetectedContent } from '@/utils/contentDetector'
import { getScriptVersionFromDescriptor } from '@/utils/descriptor'
import { parseMultisigDescriptor } from '@/utils/multisigDescriptor'
import { sanitizeScannedText } from '@/utils/parse'
import { validateDescriptor } from '@/utils/validation'

export default function ImportDescriptor() {
  const router = useRouter()
  const [
    scriptVersion,
    setScriptVersion,
    setKeyCount,
    setKeysRequired,
    setExternalDescriptor,
    setInternalDescriptor,
    setKey,
    setKeyName,
    setCreationType,
    setFingerprint,
    setExtendedPublicKey
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.scriptVersion,
      state.setScriptVersion,
      state.setKeyCount,
      state.setKeysRequired,
      state.setExternalDescriptor,
      state.setInternalDescriptor,
      state.setKey,
      state.setKeyName,
      state.setCreationType,
      state.setFingerprint,
      state.setExtendedPublicKey
    ])
  )
  const { isHardwareSupported, readNFCTag } = useNFCReader()
  const [cameraModalVisible, setCameraModalVisible] = useState(false)

  const [descriptor, setDescriptor] = useState('')
  const [isValidDescriptor, setIsValidDescriptor] = useState(true)
  const [descriptorError, setDescriptorError] = useState('')
  const [isValidating, setIsValidating] = useState(false)

  async function validateDescriptorInput(descriptorText: string) {
    if (!descriptorText.trim()) {
      setIsValidDescriptor(true)
      setDescriptorError('')
      return
    }

    setIsValidating(true)
    setDescriptorError('')
    await getDescriptorInputError(descriptorText)
      .then((error) => {
        setIsValidDescriptor(!error)
        setDescriptorError(error)
      })
      .finally(() => setIsValidating(false))
  }

  async function getDescriptorInputError(descriptorText: string) {
    const descriptorValidation = await validateDescriptor(descriptorText)
    if (!descriptorValidation) {
      return 'Invalid descriptor'
    }

    return getScriptVersionFromDescriptor(descriptorText) === scriptVersion
      ? ''
      : t('account.import.error.descriptorIncompatible')
  }

  function handleDescriptorChange(text: string) {
    setDescriptor(text)
    validateDescriptorInput(text)
  }

  async function handlePaste() {
    try {
      const text = await Clipboard.getStringAsync()
      if (text) {
        handleDescriptorChange(text)
        toast.success(t('watchonly.success.clipboardPasted'))
      } else {
        toast.error(t('watchonly.error.emptyClipboard'))
      }
    } catch {
      toast.error(t('watchonly.error.clipboardPaste'))
    }
  }

  function handleScanQR() {
    setCameraModalVisible(true)
  }

  function handleCameraClose() {
    setCameraModalVisible(false)
  }

  function importNFCData(data: NFCReadResult | null) {
    const text = data?.text ? sanitizeScannedText(data.text) : ''
    if (!text) {
      toast.error(t('watchonly.read.nfcErrorNoData'))
      return
    }
    handleDescriptorChange(text)
    toast.success(t('watchonly.success.nfcRead'))
  }

  async function handleScanNFC() {
    if (!isHardwareSupported) {
      toast.error(t('watchonly.read.nfcNotAvailable'))
      return
    }
    try {
      const data = await readNFCTag()
      importNFCData(data)
    } catch {
      toast.error(t('watchonly.read.nfcErrorNoData'))
    }
  }

  function importMultisigDescriptor() {
    const parsedData = parseMultisigDescriptor(descriptor)

    setScriptVersion(parsedData.scriptVersion)
    setKeyCount(parsedData.keyCount)
    setKeysRequired(parsedData.keysRequired)

    setExternalDescriptor(descriptor)

    const internalDescriptor = descriptor.replaceAll('/0/*', '/1/*')
    setInternalDescriptor(internalDescriptor)

    for (let i = 0; i < parsedData.keyData.length; i += 1) {
      const keyData = parsedData.keyData[i]

      setKeyName(`Key ${i + 1}`)
      setCreationType('importDescriptor')
      setFingerprint(keyData.fingerprint)
      setExtendedPublicKey(keyData.extendedPublicKey)

      setKey(i)
    }

    toast.success(t('account.import.success'))
    router.navigate('/signer/bitcoin/account/add/multiSig/finish')
  }

  function handleImport() {
    if (!descriptor.trim()) {
      toast.error(t('watchonly.error.missingFields'))
      return
    }
    if (!isValidDescriptor) {
      toast.error(t('account.import.error.descriptorFormat'))
      return
    }

    try {
      importMultisigDescriptor()
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      toast.error(`Import failed: ${reason}`)
    }
  }

  function handleCancel() {
    router.back()
  }

  function handleContentScanned(content: DetectedContent) {
    handleDescriptorChange(content.cleaned)
    toast.success(t('watchonly.success.qrScanned'))
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
          <SSVStack gap="xs">
            <SSVStack gap="md">
              <SSText center>{t('watchonly.importDescriptor.label')}</SSText>
              <SSTextInput
                value={descriptor}
                onChangeText={handleDescriptorChange}
                placeholder={t('watchonly.importDescriptor.external')}
                multiline
                numberOfLines={3}
                style={[
                  { height: 'auto', padding: 5 },
                  styles.textArea,
                  !isValidDescriptor && descriptor.trim()
                    ? styles.invalid
                    : styles.valid
                ]}
              />
            </SSVStack>
            <SSHStack gap="sm">
              <SSButton
                label={t('common.paste')}
                variant="subtle"
                onPress={handlePaste}
                style={{ flex: 1 }}
              />
              <SSButton
                label={t('common.QR')}
                variant="subtle"
                onPress={handleScanQR}
                style={{ flex: 1 }}
              />
              <SSButton
                label="NFC"
                variant="subtle"
                onPress={handleScanNFC}
                style={{ flex: 1 }}
                disabled={!isHardwareSupported}
              />
            </SSHStack>
          </SSVStack>
          <SSVStack>
            {descriptorError && (
              <SSText
                style={{
                  color: Colors.error,
                  fontSize: 12,
                  marginTop: 4,
                  textAlign: 'center'
                }}
              >
                {descriptorError}
              </SSText>
            )}
            {isValidating && (
              <SSText
                style={{
                  color: Colors.gray[500],
                  fontSize: 12,
                  marginTop: 4,
                  textAlign: 'center'
                }}
              >
                {t('common.loading')}...
              </SSText>
            )}
            <SSButton
              label={t('account.import.descriptor')}
              variant="secondary"
              onPress={handleImport}
              disabled={
                !descriptor.trim() || !isValidDescriptor || isValidating
              }
            />
            <SSButton
              label={t('common.cancel')}
              variant="ghost"
              onPress={handleCancel}
            />
          </SSVStack>
        </SSVStack>
      </SSScrollView>
      <SSCameraModal
        visible={cameraModalVisible}
        onClose={handleCameraClose}
        onContentScanned={handleContentScanned}
        context="bitcoin"
        title={t('transaction.build.options.importOutputs.qrcode')}
      />
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  invalid: {
    borderColor: Colors.error
  },
  textArea: {
    marginBottom: 8,
    minHeight: 120,
    textAlignVertical: 'top'
  },
  valid: {
    borderColor: Colors.success
  }
})
