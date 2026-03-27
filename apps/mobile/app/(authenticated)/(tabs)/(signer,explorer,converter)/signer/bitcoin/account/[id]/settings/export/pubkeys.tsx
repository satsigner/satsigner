import { type Network } from 'bdk-rn/lib/lib/enums'
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'

import { getWalletData } from '@/api/bdk'
import { SSIconEyeOn } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { getAccountWithDecryptedKeys } from '@/utils/account'
import { getExtendedKeyFromDescriptor } from '@/utils/bip32'
import { isElectrumDerivationPath } from '@/utils/bip39'
import { convertKeyFormat } from '@/utils/bitcoin'
import { shareFile } from '@/utils/filesystem'

export default function ExportPubkeys() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()

  const account = useAccountsStore((state) =>
    state.accounts.find((_account) => _account.id === accountId)
  )
  const network = useBlockchainStore((state) => state.selectedNetwork)

  const [exportContent, setExportContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [pubkeyFormat, setPubkeyFormat] = useState<'xpub' | 'zpub' | 'vpub'>(
    'xpub'
  )
  const [rawPubkeys, setRawPubkeys] = useState<string[]>([])

  useEffect(() => {
    if (!rawPubkeys.length) {
      return
    }
    const formattedPubkeys =
      pubkeyFormat === 'xpub'
        ? rawPubkeys
        : rawPubkeys.map((key) => convertKeyFormat(key, pubkeyFormat, network))
    setExportContent(formattedPubkeys.join('\n'))
  }, [pubkeyFormat, rawPubkeys, network])

  useEffect(() => {
    async function getPubkeys() {
      if (!account) {
        return
      }
      setIsLoading(true)
      try {
        const isImportAddress = account.keys[0].creationType === 'importAddress'
        const tmpAccount = await getAccountWithDecryptedKeys(account)
        const walletData = !isImportAddress
          ? await getWalletData(tmpAccount, network as Network)
          : undefined

        // For each key in the account, get its public key from the wallet data
        const pubkeys = await Promise.all(
          tmpAccount.keys.map(async (key) => {
            if (isImportAddress) {
              // For watch-only accounts, we can get the extended public key from the secret
              return key.secret.extendedPublicKey || 'N/A'
            } else {
              // For regular accounts, we need to extract the extended public key from the descriptor
              if (!walletData?.externalDescriptor) {
                return 'N/A'
              }
              const extendedKey = getExtendedKeyFromDescriptor(
                walletData.externalDescriptor
              )
              return extendedKey || 'N/A'
            }
          })
        )

        setRawPubkeys(pubkeys)
        setExportContent(pubkeys.join('\n'))
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'unknown reason'
        toast.error(`Failed to get account public keys: ${reason}`)
      } finally {
        setIsLoading(false)
      }
    }
    getPubkeys()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function exportPubkeys() {
    if (!account) {
      return
    }
    const date = new Date().toISOString().slice(0, -5)
    const ext = 'txt'
    const filename = `PublicKeys_${accountId}_${date}.${ext}`
    shareFile({
      dialogTitle: t('export.file.save'),
      fileContent: exportContent,
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
            <SSHStack gap="sm">
              <SSText uppercase>{account.name}</SSText>
              {account.policyType === 'watchonly' && (
                <SSIconEyeOn stroke="#fff" height={16} width={16} />
              )}
            </SSHStack>
          )
        }}
      />
      <SSVStack style={{ padding: 20 }}>
        <SSText center uppercase color="muted">
          {t('account.export.pubkeys')}
        </SSText>
        {isElectrumDerivationPath(account.keys[0]?.derivationPath || '') && (
          <View style={styles.electrumWarning}>
            <SSText style={styles.electrumWarningText}>
              {t('bitcoin.electrumSeedNote')}
            </SSText>
          </View>
        )}
        {!isLoading && rawPubkeys.length > 0 && (
          <SSHStack style={{ gap: 10, justifyContent: 'center' }}>
            <SSButton
              label={t('account.export.xpubFormat')}
              variant={pubkeyFormat === 'xpub' ? 'outline' : 'subtle'}
              onPress={() => setPubkeyFormat('xpub')}
              style={{ flex: 1 }}
            />
            <SSButton
              label={t('account.export.zpubFormat')}
              variant={pubkeyFormat === 'zpub' ? 'outline' : 'subtle'}
              onPress={() => setPubkeyFormat('zpub')}
              style={{ flex: 1 }}
            />
            <SSButton
              label={t('account.export.vpubFormat')}
              variant={pubkeyFormat === 'vpub' ? 'outline' : 'subtle'}
              onPress={() => setPubkeyFormat('vpub')}
              style={{ flex: 1 }}
            />
          </SSHStack>
        )}
        <View style={{ alignItems: 'center', marginVertical: 20 }}>
          {isLoading ? (
            <ActivityIndicator size="large" color={Colors.gray[400]} />
          ) : exportContent ? (
            <View
              style={{
                backgroundColor: 'white',
                borderRadius: 10,
                padding: 20
              }}
            >
              <SSQRCode
                value={exportContent}
                size={250}
                color="black"
                backgroundColor="white"
              />
            </View>
          ) : null}
        </View>
        {!isLoading && exportContent && (
          <>
            <View
              style={{
                backgroundColor: Colors.gray[950],
                borderRadius: 5,
                padding: 10
              }}
            >
              <SSText color="white" size="lg" type="mono">
                {exportContent}
              </SSText>
            </View>
            <SSClipboardCopy text={exportContent}>
              <SSButton
                label={t('common.copyToClipboard')}
                onPress={() => true}
              />
            </SSClipboardCopy>
            <SSButton
              label={t('common.downloadFile')}
              variant="secondary"
              onPress={exportPubkeys}
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

const styles = StyleSheet.create({
  electrumWarning: {
    borderColor: Colors.warning,
    borderRadius: 5,
    borderWidth: 1,
    padding: 10
  },
  electrumWarningText: {
    color: Colors.warning
  }
})
