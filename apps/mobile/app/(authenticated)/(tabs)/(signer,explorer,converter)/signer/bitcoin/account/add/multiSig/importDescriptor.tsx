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
import {
  DEFAULT_SCRIPT_VERSION,
  useAccountBuilderStore
} from '@/store/accountBuilder'
import { Colors } from '@/styles'
import { type NFCReadResult } from '@/types/models/Nfc'
import { type ScriptVersionType } from '@/types/models/Script'
import { getExtendedKeyFromDescriptor } from '@/utils/bip32'
import { type DetectedContent } from '@/utils/contentDetector'
import { getXpubFingerprint } from '@/utils/descriptor'
import { sanitizeScannedText } from '@/utils/parse'
import {
  validateDescriptor,
  validateDescriptorScriptVersion
} from '@/utils/validation'

function parseMultisigDescriptor(descriptorText: string) {
  try {
    const cleanDescriptor = descriptorText.replace(/#[a-z0-9]{8}$/, '')

    let innerDescriptor = cleanDescriptor
    if (cleanDescriptor.startsWith('wsh(') && cleanDescriptor.endsWith(')')) {
      innerDescriptor = cleanDescriptor.slice(4, -1)
    } else if (
      cleanDescriptor.startsWith('sh(') &&
      cleanDescriptor.endsWith(')')
    ) {
      innerDescriptor = cleanDescriptor.slice(3, -1)
    }

    // Parse multisig parameters: sortedmulti(2,key1,key2,key3)
    const multiMatch = innerDescriptor.match(
      /^(multi|sortedmulti)\((\d+),(.+)\)$/
    )
    if (!multiMatch) {
      throw new Error('Invalid multisig descriptor format')
    }

    const [requiredStr, keysStr] = multiMatch.slice(2)
    const keysRequired = Number.parseInt(requiredStr, 10)
    const keys = keysStr.split(',').map((key) => key.trim())

    const keyData = keys.map((key, index) => {
      // Key shape: [7af70d19/48h/1h/0h/2h]tpub.../<0;1>/*
      const bracketMatch = key.match(/^\[([^\]]+)\](.+)$/)
      if (!bracketMatch) {
        throw new Error(`Invalid key format at index ${index}`)
      }

      const [, bracketContent, afterBracket] = bracketMatch
      const [, ...restParts] = bracketContent.split('/')
      const derivationPath = restParts.join('/')

      const fingerprint = getXpubFingerprint(key)
      if (!fingerprint) {
        throw new Error(`Invalid key format at index ${index}`)
      }

      const extendedPublicKey = getExtendedKeyFromDescriptor(afterBracket)
      if (!extendedPublicKey) {
        throw new Error(`Invalid extended public key format at index ${index}`)
      }

      const addressPath = afterBracket.slice(extendedPublicKey.length)
      return {
        addressPath: addressPath || '/<0;1>/*',
        derivationPath,
        extendedPublicKey,
        fingerprint
      }
    })

    const scriptVersion: ScriptVersionType = cleanDescriptor.startsWith('sh(')
      ? 'P2SH'
      : 'P2WSH'

    return {
      keyCount: keys.length,
      keyData,
      keysRequired,
      scriptVersion
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to parse multisig descriptor: ${reason}`, {
      cause: error
    })
  }
}

export default function ImportDescriptor() {
  const router = useRouter()
  const [
    scriptVersion,
    policyType,
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
      state.policyType,
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

    if (!scriptVersion) {
      return ''
    }

    // While the builder still holds its default script version, a multisig
    // wsh() descriptor is checked as P2WSH. A version the user picked is kept,
    // so sh(wsh()) still matches P2SH-P2WSH and mismatches are reported.
    const effectiveScriptVersion =
      policyType === 'multisig' &&
      scriptVersion === DEFAULT_SCRIPT_VERSION &&
      descriptorText.includes('wsh(')
        ? 'P2WSH'
        : scriptVersion

    const scriptVersionValidation = validateDescriptorScriptVersion(
      descriptorText,
      effectiveScriptVersion
    )
    return scriptVersionValidation ? '' : 'Invalid script version'
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
