import { Descriptor } from 'bdk-rn'
import { type Network } from 'bdk-rn/lib/lib/enums'
import bs58check from 'bs58check'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'
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
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import { type Secret } from '@/types/models/Account'
import { aesDecrypt } from '@/utils/crypto'
import { shareFile } from '@/utils/filesystem'
import { convertKeyFormat } from '@/utils/bitcoin'

type PublicKeyFormat = 'xpub' | 'ypub' | 'zpub' | 'vpub'

export default function PublicKeyPage() {
  const { keyIndex } = useLocalSearchParams<{ keyIndex: string }>()
  const router = useRouter()
  const network = useBlockchainStore((state) => state.selectedNetwork)
  const [getAccountData] = useAccountBuilderStore(
    useShallow((state) => [state.getAccountData])
  )

  const [publicKey, setPublicKey] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedFormat, setSelectedFormat] = useState<PublicKeyFormat>('xpub')
  const [rawPublicKey, setRawPublicKey] = useState('')
  const [scriptVersion, setScriptVersion] = useState('P2WPKH')

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
    // Check if the public key is in a valid format
    const validPrefixes = [
      'xpub',
      'ypub',
      'zpub',
      'vpub',
      'tpub',
      'upub',
      'vpub',
      'wpub'
    ]
    const hasValidPrefix = validPrefixes.some((prefix) =>
      publicKey.startsWith(prefix)
    )

    if (!hasValidPrefix) {
      return publicKey
    }

    // Use the network-aware conversion utility
    return convertKeyFormat(publicKey, targetFormat, network)
  }

  useEffect(() => {
    async function getPublicKey() {
      if (!keyIndex) return

      setIsLoading(true)
      const pin = await getItem(PIN_KEY)
      if (!pin) return

      try {
        const accountData = getAccountData()
        const keyIndexNum = parseInt(keyIndex)
        const key = accountData.keys[keyIndexNum]

        if (!key) {
          toast.error('Key not found')
          return
        }

        // Get script version from the key
        const keyScriptVersion = key.scriptVersion || 'P2WPKH'
        setScriptVersion(keyScriptVersion)

        // Set initial selected format based on available formats
        const availableFormats = getAvailableFormats(keyScriptVersion)
        if (availableFormats.length > 0) {
          // For P2PKH, default to xpub
          // For P2SH-P2WPKH, default to ypub (more specific)
          // For P2WPKH, default to zpub (more specific)
          // For P2TR, default to vpub (more specific)
          let defaultFormat: PublicKeyFormat = 'xpub'
          if (
            keyScriptVersion === 'P2SH-P2WPKH' &&
            availableFormats.includes('ypub')
          ) {
            defaultFormat = 'ypub'
          } else if (
            keyScriptVersion === 'P2WPKH' &&
            availableFormats.includes('zpub')
          ) {
            defaultFormat = 'zpub'
          } else if (
            keyScriptVersion === 'P2TR' &&
            availableFormats.includes('vpub')
          ) {
            defaultFormat = 'vpub'
          }
          setSelectedFormat(defaultFormat)
        }

        // Get the public key from the key data
        let publicKeyString = ''
        if (typeof key.secret === 'object') {
          const secret = key.secret as Secret
          if (secret.extendedPublicKey) {
            publicKeyString = secret.extendedPublicKey
          } else if (secret.externalDescriptor) {
            // Extract public key from descriptor
            const descriptor = await new Descriptor().create(
              secret.externalDescriptor,
              network as Network
            )
            publicKeyString = await extractExtendedKeyFromDescriptor(descriptor)
          }
        }

        if (!publicKeyString) {
          toast.error('Could not extract public key')
          return
        }

        setRawPublicKey(publicKeyString)
        setPublicKey(convertPublicKeyFormat(publicKeyString, selectedFormat))
      } catch (error) {
        console.error('Failed to get public key:', error)
        toast.error('Failed to get public key')
      } finally {
        setIsLoading(false)
      }
    }

    getPublicKey()
  }, [keyIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (rawPublicKey) {
      const convertedKey = convertPublicKeyFormat(rawPublicKey, selectedFormat)
      setPublicKey(convertedKey)
    }
  }, [selectedFormat, rawPublicKey])

  async function exportPublicKey() {
    const accountData = getAccountData()
    const date = new Date().toISOString().slice(0, -5)
    const ext = 'txt'
    const filename = `PublicKey_${accountData.name}_Key${parseInt(keyIndex || '0') + 1}_${selectedFormat.toUpperCase()}_${date}.${ext}`
    shareFile({
      filename,
      fileContent: publicKey,
      dialogTitle: t('export.file.save'),
      mimeType: `text/plain`
    })
  }

  const formatButtons = getFormatButtons(scriptVersion)

  return (
    <ScrollView style={{ width: '100%' }}>
      <SSVStack style={{ padding: 20 }}>
        <SSText center uppercase color="muted">
          {t('common.publicKeys')}
        </SSText>

        {/* Format Selection Buttons */}
        {!isLoading && rawPublicKey && (
          <SSVStack gap="sm">
            <SSHStack style={{ justifyContent: 'center' }} gap="sm">
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
