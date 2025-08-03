import { Descriptor } from 'bdk-rn'
import { type Network } from 'bdk-rn/lib/lib/enums'
import bs58check from 'bs58check'
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { toast } from 'sonner-native'

import { extractExtendedKeyFromDescriptor } from '@/api/bdk'
import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import { PIN_KEY } from '@/config/auth'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { getItem } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import { type Account, type Secret } from '@/types/models/Account'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { aesDecrypt } from '@/utils/crypto'
import { shareFile } from '@/utils/filesystem'

type PublicKeyFormat = 'xpub' | 'ypub' | 'zpub' | 'vpub'

export default function PublicKeyPage() {
  const { id: accountId, keyIndex } = useLocalSearchParams<
    AccountSearchParams & { keyIndex: string }
  >()

  const account = useAccountsStore((state) =>
    state.accounts.find((_account) => _account.id === accountId)
  )
  const network = useBlockchainStore((state) => state.selectedNetwork)

  const [publicKey, setPublicKey] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedFormat, setSelectedFormat] = useState<PublicKeyFormat>('xpub')
  const [rawPublicKey, setRawPublicKey] = useState('')
  const [scriptVersion, setScriptVersion] = useState<string>('P2PKH')

  // Get available formats based on script version
  function getAvailableFormats(scriptVersion: string): PublicKeyFormat[] {
    switch (scriptVersion) {
      case 'P2PKH':
        return ['xpub']
      case 'P2SH-P2WPKH':
        return ['xpub', 'ypub']
      case 'P2WPKH':
        return ['xpub', 'zpub']
      case 'P2TR':
        return ['xpub', 'vpub']
      default:
        return ['xpub']
    }
  }

  // Get format button data based on script version
  function getFormatButtons(
    scriptVersion: string
  ): { format: PublicKeyFormat; label: string }[] {
    const availableFormats = getAvailableFormats(scriptVersion)
    const allFormats: { format: PublicKeyFormat; label: string }[] = [
      { format: 'xpub', label: 'XPUB' },
      { format: 'ypub', label: 'YPUB' },
      { format: 'zpub', label: 'ZPUB' },
      { format: 'vpub', label: 'VPUB' }
    ]

    return allFormats.filter((format) =>
      availableFormats.includes(format.format)
    )
  }

  function convertPublicKeyFormat(
    publicKey: string,
    targetFormat: PublicKeyFormat
  ): string {
    if (!publicKey.startsWith('tpub') && !publicKey.startsWith('xpub')) {
      return publicKey
    }

    try {
      const decoded = bs58check.decode(publicKey)
      let version: Uint8Array

      switch (targetFormat) {
        case 'xpub':
          version = new Uint8Array([0x04, 0x88, 0xb2, 0x1e]) // xpub
          break
        case 'ypub':
          version = new Uint8Array([0x04, 0x9d, 0x7c, 0xb2]) // ypub
          break
        case 'zpub':
          version = new Uint8Array([0x04, 0xb2, 0x47, 0x46]) // zpub
          break
        case 'vpub':
          version = new Uint8Array([0x04, 0x5f, 0x1c, 0xf6]) // vpub
          break
        default:
          return publicKey
      }

      const newDecoded = new Uint8Array([...version, ...decoded.slice(4)])
      return bs58check.encode(newDecoded)
    } catch (error) {
      console.error('Failed to convert public key format:', error)
      return publicKey
    }
  }

  useEffect(() => {
    async function getPublicKey() {
      if (!account || !keyIndex) return

      setIsLoading(true)
      const pin = await getItem(PIN_KEY)
      if (!pin) return

      try {
        const keyIndexNum = parseInt(keyIndex)
        const key = account.keys[keyIndexNum]

        if (!key) {
          toast.error('Key not found')
          return
        }

        // Get script version from the key
        const keyScriptVersion = key.scriptVersion || 'P2PKH'
        setScriptVersion(keyScriptVersion)

        // Set initial selected format based on available formats
        const availableFormats = getAvailableFormats(keyScriptVersion)
        if (availableFormats.length > 0) {
          setSelectedFormat(availableFormats[0])
        }

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

        // Get the public key
        let publicKey = ''
        if (decryptedSecret.extendedPublicKey) {
          publicKey = decryptedSecret.extendedPublicKey
        } else if (decryptedSecret.externalDescriptor) {
          // Extract public key from descriptor
          const descriptor = await new Descriptor().create(
            decryptedSecret.externalDescriptor,
            network as Network
          )
          publicKey = await extractExtendedKeyFromDescriptor(descriptor)
        }

        if (!publicKey) {
          toast.error('Could not extract public key')
          return
        }

        setRawPublicKey(publicKey)
        setPublicKey(convertPublicKeyFormat(publicKey, selectedFormat))
      } catch (error) {
        console.error('Failed to get public key:', error)
        toast.error('Failed to get public key')
      } finally {
        setIsLoading(false)
      }
    }

    getPublicKey()
  }, [account, keyIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (rawPublicKey) {
      const convertedKey = convertPublicKeyFormat(rawPublicKey, selectedFormat)
      setPublicKey(convertedKey)
    }
  }, [selectedFormat, rawPublicKey])

  async function exportPublicKey() {
    if (!account) return
    const date = new Date().toISOString().slice(0, -5)
    const ext = 'txt'
    const filename = `PublicKey_${account.name}_Key${parseInt(keyIndex || '0') + 1}_${selectedFormat.toUpperCase()}_${date}.${ext}`
    shareFile({
      filename,
      fileContent: publicKey,
      dialogTitle: t('export.file.save'),
      mimeType: `text/plain`
    })
  }

  if (!account) return <Redirect href="/" />

  const formatButtons = getFormatButtons(scriptVersion)

  return (
    <ScrollView style={{ width: '100%' }}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('common.publicKeys')}</SSText>
          ),
          headerRight: undefined
        }}
      />
      <SSVStack style={{ padding: 20 }}>
        <SSText center uppercase color="muted">
          {t('account.publicKey.title')}
        </SSText>

        {/* Format Selection Buttons */}
        {!isLoading && rawPublicKey && (
          <SSHStack
            style={{ marginBottom: 20, justifyContent: 'center' }}
            gap="sm"
          >
            {formatButtons.map(({ format, label }) => (
              <SSButton
                key={format}
                label={label}
                variant={selectedFormat === format ? 'gradient' : 'secondary'}
                onPress={() => setSelectedFormat(format)}
                style={{ flex: 1 }}
              />
            ))}
          </SSHStack>
        )}

        {/* QR Code */}
        <View style={{ alignItems: 'center', marginVertical: 20 }}>
          {isLoading ? (
            <View style={{ height: 250, justifyContent: 'center' }}>
              <SSText center color="muted">
                Loading...
              </SSText>
            </View>
          ) : publicKey ? (
            <View
              style={{
                backgroundColor: 'white',
                padding: 20,
                borderRadius: 10
              }}
            >
              <SSQRCode
                value={publicKey}
                size={250}
                color="black"
                backgroundColor="white"
              />
            </View>
          ) : null}
        </View>

        {/* Public Key Text */}
        {!isLoading && publicKey && (
          <>
            <View
              style={{
                padding: 10,
                backgroundColor: Colors.gray[950],
                borderRadius: 5
              }}
            >
              <SSText color="white" size="lg" type="mono" selectable>
                {publicKey}
              </SSText>
            </View>

            {/* Action Buttons */}
            <SSClipboardCopy text={publicKey}>
              <SSButton
                label={t('common.copyToClipboard')}
                onPress={() => true}
              />
            </SSClipboardCopy>
            <SSButton
              label={t('common.downloadFile')}
              variant="secondary"
              onPress={exportPublicKey}
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
