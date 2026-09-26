import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Clipboard from 'expo-clipboard'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
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
import { type ScriptVersionType } from '@/types/models/Script'
import { getExtendedKeyFromDescriptor } from '@/utils/bip32'
import { getXpubFingerprint } from '@/utils/descriptor'
import {
  validateDescriptor,
  validateDescriptorScriptVersion
} from '@/utils/validation'

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
  const [permission, requestPermission] = useCameraPermissions()

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

    const descriptorValidation = await validateDescriptor(descriptorText)

    if (!descriptorValidation) {
      setIsValidDescriptor(false)
      setDescriptorError('Invalid descriptor')
      return
    }

    if (scriptVersion) {
      // For multisig descriptors, we need to be more flexible with script version validation
      // because the default script version might not be set correctly yet
      let effectiveScriptVersion = scriptVersion

      // If we're in a multisig context and the descriptor uses wsh, use P2WSH
      if (policyType === 'multisig' && descriptorText.includes('wsh(')) {
        effectiveScriptVersion = 'P2WSH'
      }

      const scriptVersionValidation = validateDescriptorScriptVersion(
        descriptorText,
        effectiveScriptVersion
      )

      if (!scriptVersionValidation) {
        setIsValidDescriptor(false)
        setDescriptorError('Invalid script version')
        return
      }
    }

    setIsValidDescriptor(true)
    setDescriptorError('')
    setIsValidating(false)
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
    if (!permission?.granted) {
      requestPermission()
      return
    }
    setCameraModalVisible(true)
  }

  async function handleScanNFC() {
    if (!isHardwareSupported) {
      toast.error(t('watchonly.read.nfcNotAvailable'))
      return
    }
    try {
      const data = await readNFCTag()
      if (data && typeof data === 'string') {
        handleDescriptorChange(data)
        toast.success(t('watchonly.success.nfcRead'))
      } else {
        toast.error(t('watchonly.read.nfcErrorNoData'))
      }
    } catch {
      toast.error(t('watchonly.read.nfcErrorNoData'))
    }
  }

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
      const keysRequired = parseInt(requiredStr, 10)
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
          throw new Error(
            `Invalid extended public key format at index ${index}`
          )
        }

        const addressPath = afterBracket.slice(extendedPublicKey.length)
        return {
          addressPath: addressPath || '/<0;1>/*',
          derivationPath,
          extendedPublicKey,
          fingerprint
        }
      })

      const scriptVersion: ScriptVersionType = cleanDescriptor.startsWith(
        'wsh('
      )
        ? 'P2WSH'
        : cleanDescriptor.startsWith('sh(')
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
      const parsedData = parseMultisigDescriptor(descriptor)

      setScriptVersion(parsedData.scriptVersion)
      setKeyCount(parsedData.keyCount)
      setKeysRequired(parsedData.keysRequired)

      setExternalDescriptor(descriptor)

      const internalDescriptor = descriptor.replace(/\/0\/\*/g, '/1/*')
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
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      toast.error(`Import failed: ${reason}`)
    }
  }

  function handleCancel() {
    router.back()
  }

  function handleQRCodeScanned({ data }: { data: string }) {
    handleDescriptorChange(data)
    setCameraModalVisible(false)
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
      <SSModal
        visible={cameraModalVisible}
        onClose={() => setCameraModalVisible(false)}
      >
        <SSVStack gap="lg" style={{ flex: 1 }}>
          <SSText center size="lg" weight="bold">
            {t('transaction.build.options.importOutputs.qrcode')}
          </SSText>
          <SSText center color="muted">
            {t('camera.scanText')}
          </SSText>
          {permission?.granted ? (
            <CameraView
              style={{ flex: 1 }}
              onBarcodeScanned={handleQRCodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ['qr']
              }}
            />
          ) : (
            <SSVStack gap="md" style={{ flex: 1, justifyContent: 'center' }}>
              <SSText center color="muted">
                {t('camera.permissions')}
              </SSText>
              <SSButton
                label={t('camera.enableCameraAccess')}
                onPress={requestPermission}
              />
            </SSVStack>
          )}
          <SSButton
            label={t('common.cancel')}
            variant="ghost"
            onPress={() => setCameraModalVisible(false)}
          />
        </SSVStack>
      </SSModal>
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
