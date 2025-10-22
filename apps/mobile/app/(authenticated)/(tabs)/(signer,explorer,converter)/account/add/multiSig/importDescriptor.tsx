import { CameraView, useCameraPermissions } from 'expo-camera/next'
import * as Clipboard from 'expo-clipboard'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

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
import { Colors } from '@/styles'
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
  const { isAvailable, readNFCTag } = useNFCReader()
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [permission, requestPermission] = useCameraPermissions()

  // State for descriptor input
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

    try {
      // Basic descriptor validation
      const descriptorValidation = await validateDescriptor(descriptorText)

      if (!descriptorValidation.isValid) {
        setIsValidDescriptor(false)
        setDescriptorError(
          t(`account.import.error.${descriptorValidation.error}`)
        )
        return
      }

      // Script version validation for multisig
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

        if (!scriptVersionValidation.isValid) {
          setIsValidDescriptor(false)
          setDescriptorError(
            scriptVersionValidation.error || 'Invalid script version'
          )
          return
        }
      }

      setIsValidDescriptor(true)
      setDescriptorError('')
    } catch {
      setIsValidDescriptor(false)
      setDescriptorError(t('account.import.error.descriptorFormat'))
    } finally {
      setIsValidating(false)
    }
  }

  function handleDescriptorChange(text: string) {
    setDescriptor(text)
    validateDescriptorInput(text)
  }

  function handlePaste() {
    Clipboard.getStringAsync()
      .then((text) => {
        if (text) {
          handleDescriptorChange(text)
          toast.success(t('watchonly.success.clipboardPasted'))
        } else {
          toast.error(t('watchonly.error.emptyClipboard'))
        }
      })
      .catch(() => {
        toast.error(t('watchonly.error.clipboardPaste'))
      })
  }

  function handleScanQR() {
    if (!permission?.granted) {
      requestPermission()
      return
    }
    setCameraModalVisible(true)
  }

  function handleScanNFC() {
    if (!isAvailable) {
      toast.error(t('watchonly.read.nfcNotAvailable'))
      return
    }
    readNFCTag()
      .then((data) => {
        if (data && typeof data === 'string') {
          handleDescriptorChange(data)
          toast.success(t('watchonly.success.nfcRead'))
        } else {
          toast.error(t('watchonly.read.nfcErrorNoData'))
        }
      })
      .catch(() => {
        toast.error(t('watchonly.read.nfcErrorNoData'))
      })
  }

  function parseMultisigDescriptor(descriptorText: string) {
    try {
      // Remove checksum if present
      const cleanDescriptor = descriptorText.replace(/#[a-z0-9]{8}$/, '')

      // Extract the inner multisig descriptor (remove outer wsh/sh wrapper)
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

      const [, , requiredStr, keysStr] = multiMatch
      const keysRequired = parseInt(requiredStr, 10)
      const keys = keysStr.split(',').map((key) => key.trim())

      // Extract key information from each key
      const keyData = keys.map((key, index) => {
        // Extract fingerprint and derivation path: [7af70d19/48h/1h/0h/2h]tpub...
        // Use a more flexible approach to handle longer extended public keys
        const bracketMatch = key.match(/^\[([^\]]+)\](.+)$/)
        if (!bracketMatch) {
          throw new Error(`Invalid key format at index ${index}`)
        }

        const [, bracketContent, afterBracket] = bracketMatch
        const bracketParts = bracketContent.split('/')
        const fingerprint = bracketParts[0]
        const derivationPath = bracketParts.slice(1).join('/')

        // Extract extended public key and address path
        const xpubMatch = afterBracket.match(/^([a-zA-Z0-9]+)(.*)$/)
        if (!xpubMatch) {
          throw new Error(
            `Invalid extended public key format at index ${index}`
          )
        }

        const [, extendedPublicKey, addressPath] = xpubMatch
        return {
          fingerprint,
          derivationPath,
          extendedPublicKey,
          addressPath: addressPath || '/<0;1>/*'
        }
      })

      return {
        keysRequired,
        keyCount: keys.length,
        keyData,
        scriptVersion: (cleanDescriptor.startsWith('wsh(')
          ? 'P2WSH'
          : cleanDescriptor.startsWith('sh(')
            ? 'P2SH'
            : 'P2WSH') as 'P2WSH' | 'P2SH'
      }
    } catch (error) {
      throw new Error(
        `Failed to parse multisig descriptor: ${(error as Error).message}`
      )
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
      // Parse the multisig descriptor
      const parsedData = parseMultisigDescriptor(descriptor)

      // Update account builder store with parsed data
      setScriptVersion(parsedData.scriptVersion)
      setKeyCount(parsedData.keyCount)
      setKeysRequired(parsedData.keysRequired)

      // Set the descriptors
      setExternalDescriptor(descriptor)

      // Create internal descriptor by replacing /0/* with /1/*
      const internalDescriptor = descriptor.replace(/\/0\/\*/g, '/1/*')
      setInternalDescriptor(internalDescriptor)

      // Set up each key in the account builder store
      for (let i = 0; i < parsedData.keyData.length; i++) {
        const keyData = parsedData.keyData[i]

        // Set key properties
        setKeyName(`Key ${i + 1}`)
        setCreationType('importDescriptor')
        setFingerprint(keyData.fingerprint)
        setExtendedPublicKey(keyData.extendedPublicKey)

        // Set the individual key
        setKey(i)
      }

      toast.success(t('account.import.success'))
      // Navigate to finish page to complete account creation
      router.navigate('/account/add/multiSig/finish')
    } catch (error) {
      toast.error(`Import failed: ${(error as Error).message}`)
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
      <ScrollView>
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
                  { padding: 5, height: 'auto' },
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
                disabled={!isAvailable}
              />
            </SSHStack>
          </SSVStack>
          <SSVStack>
            {descriptorError && (
              <SSText
                style={{
                  color: Colors.error,
                  fontSize: 12,
                  textAlign: 'center',
                  marginTop: 4
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
                  textAlign: 'center',
                  marginTop: 4
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
      </ScrollView>
      <SSModal
        visible={cameraModalVisible}
        onClose={() => setCameraModalVisible(false)}
      >
        <SSVStack gap="lg" style={{ flex: 1 }}>
          <SSText center size="lg" weight="bold">
            {t('camera.scanQRCode')}
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
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 8
  },
  valid: {
    borderColor: Colors.success
  },
  invalid: {
    borderColor: Colors.error
  }
})
