import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { ScrollView, View, type ViewInstance } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSShareableQR from '@/components/SSShareableQR'
import SSShareButton from '@/components/SSShareButton'
import SSText from '@/components/SSText'
import { useAsyncEffect } from '@/hooks/useAsyncEffect'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { getExtendedKeyFromDescriptor } from '@/utils/bip32'
import {
  convertKeyFormat,
  getNetworkKeyFormatName,
  getPubkeyExportFormats,
  type PubkeyExportFormat
} from '@/utils/bitcoin'
import { decryptAccountKeySecret } from '@/utils/decryption'
import { shareFile } from '@/utils/filesystem'

export default function PublicKeyPage() {
  const { id: accountId, keyIndex } = useLocalSearchParams<
    AccountSearchParams & { keyIndex: string }
  >()

  const account = useAccountsStore((state) =>
    state.accounts.find((_account) => _account.id === accountId)
  )
  const network = useBlockchainStore((state) => state.selectedNetwork)

  const [isLoading, setIsLoading] = useState(true)
  const qrRef = useRef<ViewInstance>(null)
  const [rawPublicKey, setRawPublicKey] = useState('')

  const keyIndexNum = account && keyIndex ? Number(keyIndex) : null
  const key = keyIndexNum !== null ? account?.keys[keyIndexNum] : null
  const scriptVersion = key?.scriptVersion || 'P2PKH'

  const [selectedFormat, setSelectedFormat] =
    useState<PubkeyExportFormat>('xpub')

  const convertPublicKeyFormat = useCallback(
    (publicKey: string, targetFormat: PubkeyExportFormat): string => {
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

      return convertKeyFormat(publicKey, targetFormat, network)
    },
    [network]
  )

  async function getPublicKey() {
    if (!account || !keyIndex || !key) {
      return
    }
    const secret = await decryptAccountKeySecret(account.id, key.index)
    const publicKey =
      secret.extendedPublicKey ??
      (secret.externalDescriptor
        ? getExtendedKeyFromDescriptor(secret.externalDescriptor)
        : '')
    if (!publicKey) {
      toast.error('Could not extract public key')
      return
    }
    setRawPublicKey(publicKey)
  }

  useAsyncEffect(async () => {
    try {
      setIsLoading(true)
      await getPublicKey()
    } catch {
      toast.error('Failed to get public key')
    }
    setIsLoading(false)
  }, [account, keyIndex, key, network, selectedFormat, convertPublicKeyFormat])

  const publicKey = rawPublicKey
    ? convertPublicKeyFormat(rawPublicKey, selectedFormat)
    : ''

  function exportPublicKey() {
    if (!account) {
      return
    }
    const date = new Date().toISOString().slice(0, -5)
    const ext = 'txt'
    const filename = `PublicKey_${account.name}_Key${
      Number.parseInt(keyIndex || '0', 10) + 1
    }_${getNetworkKeyFormatName(selectedFormat, network).toUpperCase()}_${date}.${ext}`
    shareFile({
      dialogTitle: t('export.file.save'),
      fileContent: publicKey,
      filename,
      mimeType: `text/plain`
    })
  }

  if (!account) {
    return <Redirect href="/" />
  }

  const formats = getPubkeyExportFormats(account.policyType, scriptVersion)

  return (
    <ScrollView style={{ width: '100%' }}>
      <Stack.Screen
        options={{
          headerRight: undefined,
          headerTitle: () => <SSText uppercase>{t('common.publicKeys')}</SSText>
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
              {formats.map((format) => (
                <SSButton
                  key={format}
                  label={t(
                    `account.seed.formatButtons.${getNetworkKeyFormatName(format, network)}`
                  )}
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
            <SSShareableQR
              qrRef={qrRef}
              value={publicKey}
              size={250}
              color="black"
              backgroundColor="white"
              containerStyle={{
                backgroundColor: 'white',
                borderRadius: 10,
                padding: 20
              }}
              hideShareButton
            />
          ) : null}
        </View>

        {/* Public Key Text */}
        {!isLoading && publicKey && (
          <>
            <View
              style={{
                backgroundColor: Colors.gray[950],
                borderRadius: 5,
                padding: 10
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
            <SSShareButton qrRef={qrRef} />
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
