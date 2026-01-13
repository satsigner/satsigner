import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { toast } from 'sonner-native'

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
import { type Secret } from '@/types/models/Account'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { type Network } from '@/types/settings/blockchain'
import { getExtendedKeyFromDescriptor } from '@/utils/bip32'
import { convertKeyFormat } from '@/utils/bitcoin'
import { aesDecrypt } from '@/utils/crypto'
import { shareFile } from '@/utils/filesystem'

// Helper function to get the appropriate translation key for key format buttons
type PublicKeyFormat = 'xpub' | 'ypub' | 'zpub' | 'vpub' | 'tpub' | 'upub'

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
  const [rawPublicKey, setRawPublicKey] = useState('')

  // Derive scriptVersion and selectedFormat from account data and network
  const keyIndexNum = account && keyIndex ? Number(keyIndex) : null
  const key = keyIndexNum !== null ? account?.keys[keyIndexNum] : null
  const scriptVersion = key?.scriptVersion || 'P2PKH'

  // Derive the default format based on network and script version
  const getDefaultFormat = (
    scriptVersion: string,
    network: Network
  ): PublicKeyFormat => {
    if (scriptVersion === 'P2SH-P2WSH') {
      // For P2SH-P2WSH, default to ypub/upub (more specific)
      return network === 'bitcoin' ? 'ypub' : 'upub'
    } else if (scriptVersion === 'P2WSH') {
      // For P2WSH, default to zpub/vpub (more specific)
      return network === 'bitcoin' ? 'zpub' : 'vpub'
    } else {
      // For P2SH and others, default to xpub/tpub
      return network === 'bitcoin' ? 'xpub' : 'tpub'
    }
  }

  const [selectedFormat, setSelectedFormat] = useState<PublicKeyFormat>('xpub')

  // Update selected format when script version or network changes
  useEffect(() => {
    const newFormat = getDefaultFormat(scriptVersion, network)
    setSelectedFormat(newFormat)
  }, [scriptVersion, network])

  // Get format button data based on script version and network
  function getFormatButtons(scriptVersion: string) {
    const formatButtons: {
      format: PublicKeyFormat
      label: string
    }[] = []

    // Handle multisig script types specifically
    if (scriptVersion === 'P2SH') {
      // P2SH: Only show xpub/tpub
      formatButtons.push({
        format: network === 'bitcoin' ? 'xpub' : 'tpub',
        label: t(
          `account.seed.formatButtons.${
            network === 'bitcoin' ? 'xpub' : 'tpub'
          }`
        )
      })
    } else if (scriptVersion === 'P2SH-P2WSH') {
      // P2SH-P2WSH: Show xpub/ypub or tpub/upub
      formatButtons.push({
        format: network === 'bitcoin' ? 'xpub' : 'tpub',
        label: t(
          `account.seed.formatButtons.${
            network === 'bitcoin' ? 'xpub' : 'tpub'
          }`
        )
      })
      formatButtons.push({
        format: network === 'bitcoin' ? 'ypub' : 'upub',
        label: t(
          `account.seed.formatButtons.${
            network === 'bitcoin' ? 'ypub' : 'upub'
          }`
        )
      })
    } else if (scriptVersion === 'P2WSH') {
      // P2WSH: Show xpub/zpub or tpub/vpub
      formatButtons.push({
        format: network === 'bitcoin' ? 'xpub' : 'tpub',
        label: t(
          `account.seed.formatButtons.${
            network === 'bitcoin' ? 'xpub' : 'tpub'
          }`
        )
      })
      formatButtons.push({
        format: network === 'bitcoin' ? 'zpub' : 'vpub',
        label: t(
          `account.seed.formatButtons.${
            network === 'bitcoin' ? 'zpub' : 'vpub'
          }`
        )
      })
    } else if (scriptVersion === 'P2PKH') {
      // P2PKH: Only show xpub/tpub
      formatButtons.push({
        format: network === 'bitcoin' ? 'xpub' : 'tpub',
        label: t(
          `account.seed.formatButtons.${
            network === 'bitcoin' ? 'xpub' : 'tpub'
          }`
        )
      })
    } else if (scriptVersion === 'P2SH-P2WPKH') {
      // P2SH-P2WPKH: Show xpub/ypub or tpub/upub
      formatButtons.push({
        format: network === 'bitcoin' ? 'xpub' : 'tpub',
        label: t(
          `account.seed.formatButtons.${
            network === 'bitcoin' ? 'xpub' : 'tpub'
          }`
        )
      })
      formatButtons.push({
        format: network === 'bitcoin' ? 'ypub' : 'upub',
        label: t(
          `account.seed.formatButtons.${
            network === 'bitcoin' ? 'ypub' : 'upub'
          }`
        )
      })
    } else if (scriptVersion === 'P2WPKH') {
      // P2WPKH: Show xpub/zpub or tpub/vpub
      formatButtons.push({
        format: network === 'bitcoin' ? 'xpub' : 'tpub',
        label: t(
          `account.seed.formatButtons.${
            network === 'bitcoin' ? 'xpub' : 'tpub'
          }`
        )
      })
      formatButtons.push({
        format: network === 'bitcoin' ? 'zpub' : 'vpub',
        label: t(
          `account.seed.formatButtons.${
            network === 'bitcoin' ? 'zpub' : 'vpub'
          }`
        )
      })
    } else if (scriptVersion === 'P2TR') {
      // P2TR: Only show vpub (same for all networks)
      formatButtons.push({
        format: 'vpub',
        label: t('account.seed.formatButtons.vpub')
      })
    }

    return formatButtons
  }

  const convertPublicKeyFormat = useCallback(
    (publicKey: string, targetFormat: PublicKeyFormat): string => {
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
    },
    [network]
  )

  useEffect(() => {
    async function getPublicKey() {
      if (!account || !keyIndex || !key) return

      setIsLoading(true)
      const pin = await getItem(PIN_KEY)
      if (!pin) return

      try {
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
          publicKey = getExtendedKeyFromDescriptor(
            decryptedSecret.externalDescriptor
          )
        }

        if (!publicKey) {
          toast.error('Could not extract public key')
          return
        }

        setRawPublicKey(publicKey)
        setPublicKey(convertPublicKeyFormat(publicKey, selectedFormat))
      } catch {
        toast.error('Failed to get public key')
      } finally {
        setIsLoading(false)
      }
    }

    getPublicKey()
  }, [account, keyIndex, key, network, selectedFormat, convertPublicKeyFormat]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (rawPublicKey) {
      const convertedKey = convertPublicKeyFormat(rawPublicKey, selectedFormat)
      setPublicKey(convertedKey)
    }
  }, [selectedFormat, rawPublicKey, convertPublicKeyFormat])

  async function exportPublicKey() {
    if (!account) return
    const date = new Date().toISOString().slice(0, -5)
    const ext = 'txt'
    const filename = `PublicKey_${account.name}_Key${
      parseInt(keyIndex || '0', 10) + 1
    }_${selectedFormat.toUpperCase()}_${date}.${ext}`
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
                  variant={selectedFormat === format ? 'secondary' : 'default'}
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
