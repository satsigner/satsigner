import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { walletNameFromDescriptor } from 'react-native-bdk-sdk'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import { PIN_KEY } from '@/config/auth'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { getItem } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import { type Secret } from '@/types/models/Account'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import { aesDecrypt } from '@/utils/crypto'
import { shareFile } from '@/utils/filesystem'
import { getOutputDescriptorStringForKey } from '@/utils/getOutputDescriptorForKey'

export default function DescriptorPage() {
  const { id: accountId, keyIndex } = useLocalSearchParams<
    AccountSearchParams & { keyIndex: string }
  >()

  const account = useAccountsStore((state) =>
    state.accounts.find((_account) => _account.id === accountId)
  )
  const network = useBlockchainStore((state) => state.selectedNetwork)

  const [descriptor, setDescriptor] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [keyName, setKeyName] = useState('')
  const [creationType, setCreationType] = useState('')
  const [scriptVersion, setScriptVersion] = useState<string>('P2PKH')
  const [_descriptorComponents, setDescriptorComponents] = useState<{
    scriptFunction: string
    fingerprint: string
    derivationPath: string
    publicKey: string
    checksum: string
  } | null>(null)

  // Parse descriptor components for display
  function parseDescriptorComponents(descriptor: string) {
    try {
      // Extract script function (e.g., pkh, sh, wpkh, tr)
      const scriptMatch = descriptor.match(/^([a-z]+)\(/)
      const scriptFunction = scriptMatch ? scriptMatch[1] : ''

      // Extract fingerprint and derivation path
      const fingerprintMatch = descriptor.match(/\[([0-9a-fA-F]{8})\/?/)
      const fingerprint = fingerprintMatch ? fingerprintMatch[1] : ''

      // Extract derivation path - handle both with and without fingerprint
      let derivationPath = ''
      const pathMatch = descriptor.match(/\[[0-9a-fA-F]{8}\/([0-9'/]+)\]/)
      if (pathMatch) {
        derivationPath = `m/${pathMatch[1]}`
      } else {
        // Try to extract path without fingerprint
        const simplePathMatch = descriptor.match(/([0-9'/]+)\/[0-9]+\/\*/)
        if (simplePathMatch) {
          derivationPath = `m/${simplePathMatch[1]}`
        }
      }

      // Extract public key (xpub, ypub, zpub, vpub, etc.)
      const pubKeyMatch = descriptor.match(/([a-z]pub[a-zA-Z0-9]{107})/)
      const publicKey = pubKeyMatch ? pubKeyMatch[1] : ''

      // Extract checksum
      const checksumMatch = descriptor.match(/#([a-z0-9]+)$/)
      const checksum = checksumMatch ? checksumMatch[1] : ''

      return {
        checksum,
        derivationPath,
        fingerprint,
        publicKey,
        scriptFunction
      }
    } catch {
      return null
    }
  }

  useEffect(() => {
    async function getDescriptor() {
      if (!account || !keyIndex) {
        return
      }

      setIsLoading(true)
      const pin = await getItem(PIN_KEY)
      if (!pin) {
        return
      }

      try {
        const keyIndexNum = parseInt(keyIndex, 10)
        const key = account.keys[keyIndexNum]

        if (!key) {
          toast.error('Key not found')
          return
        }

        setKeyName(key.name || `Key ${keyIndexNum + 1}`)
        setCreationType(key.creationType)
        setScriptVersion(key.scriptVersion || 'P2PKH')

        // Decrypt the key's secret
        let decryptedSecret: Secret
        if (typeof key.secret === 'string') {
          const decryptedSecretString = await aesDecrypt(
            key.secret,
            pin,
            key.iv
          )
          decryptedSecret = JSON.parse(decryptedSecretString) as Secret
        } else {
          decryptedSecret = key.secret as Secret
        }

        const descriptorString = getOutputDescriptorStringForKey(
          key,
          decryptedSecret,
          network
        )

        if (descriptorString && !descriptorString.includes('#')) {
          try {
            walletNameFromDescriptor(
              descriptorString,
              undefined,
              appNetworkToBdkNetwork(network)
            )
          } catch {
            // Keep the original descriptor if BDK fails
          }
        }

        if (!descriptorString) {
          toast.error('Could not generate descriptor')
          return
        }

        setDescriptor(descriptorString)
        const components = parseDescriptorComponents(descriptorString)
        setDescriptorComponents(components)
      } catch {
        toast.error('Failed to get descriptor')
      } finally {
        setIsLoading(false)
      }
    }

    getDescriptor()
  }, [account, keyIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  function exportDescriptor() {
    if (!account) {
      return
    }
    const date = new Date().toISOString().slice(0, -5)
    const ext = 'txt'
    const filename = `Descriptor_${account.name}_${keyName}_${date}.${ext}`
    shareFile({
      dialogTitle: t('export.file.save'),
      fileContent: descriptor,
      filename,
      mimeType: `text/plain`
    })
  }

  if (!account) {
    return <Redirect href="/" />
  }

  return (
    <ScrollView style={{ width: '100%' }}>
      <Stack.Screen
        options={{
          headerRight: undefined,
          headerTitle: () => (
            <SSText uppercase>{t('account.descriptor.title')}</SSText>
          )
        }}
      />
      <SSVStack style={{ padding: 20 }}>
        <SSText center uppercase color="muted">
          {t('account.descriptor.title')}
        </SSText>

        {/* Key Information */}
        {!isLoading && (
          <SSVStack gap="sm" style={{ marginBottom: 20 }}>
            <SSText center color="muted">
              {keyName}
            </SSText>
            <SSText center color="muted" size="sm">
              {t('account.descriptor.creationType', { type: creationType })}
            </SSText>
            <SSText center color="muted" size="sm">
              {t('account.descriptor.scriptVersion', {
                version: scriptVersion
              })}
            </SSText>
          </SSVStack>
        )}

        {/* QR Code */}
        <View style={{ alignItems: 'center', marginVertical: 20 }}>
          {isLoading ? (
            <View style={{ height: 250, justifyContent: 'center' }}>
              <SSText center color="muted">
                Loading...
              </SSText>
            </View>
          ) : descriptor ? (
            <View
              style={{
                backgroundColor: 'white',
                borderRadius: 10,
                padding: 20
              }}
            >
              <SSQRCode
                value={descriptor}
                size={250}
                color="black"
                backgroundColor="white"
              />
            </View>
          ) : null}
        </View>

        {/* Descriptor Text */}
        {!isLoading && descriptor && (
          <>
            <View
              style={{
                backgroundColor: Colors.gray[950],
                borderRadius: 5,
                padding: 10
              }}
            >
              <SSText color="white" size="lg" type="mono" selectable>
                {descriptor}
              </SSText>
            </View>

            {/* Action Buttons */}
            <SSClipboardCopy text={descriptor}>
              <SSButton
                label={t('common.copyToClipboard')}
                onPress={() => true}
              />
            </SSClipboardCopy>
            <SSButton
              label={t('common.downloadFile')}
              variant="secondary"
              onPress={exportDescriptor}
            />
          </>
        )}

        <SSButton
          label={t('common.cancel')}
          variant="ghost"
          onPress={() => router.back()}
        />
      </SSVStack>
    </ScrollView>
  )
}
