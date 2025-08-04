import { type Network } from 'bdk-rn/lib/lib/enums'
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'

import { getWalletData } from '@/api/bdk'
import { SSIconEyeOn } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSQRCode from '@/components/SSQRCode'
import SSRadioButton from '@/components/SSRadioButton'
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

export default function ExportDescriptors() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()

  const account = useAccountsStore((state) =>
    state.accounts.find((_account) => _account.id === accountId)
  )
  const network = useBlockchainStore((state) => state.selectedNetwork)

  const [exportContent, setExportContent] = useState('')
  const [showSeparate, setShowSeparate] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function getDescriptors() {
      if (!account) return
      const pin = await getItem(PIN_KEY)
      if (!pin) return
      try {
        const isImportAddress = account.keys[0].creationType === 'importAddress'

        const temporaryAccount = JSON.parse(JSON.stringify(account)) as Account

        for (const key of temporaryAccount.keys) {
          const decryptedSecretString = await aesDecrypt(
            key.secret as string,
            pin,
            key.iv
          )
          const decryptedSecret = JSON.parse(decryptedSecretString) as Secret
          key.secret = decryptedSecret
        }

        const walletData = !isImportAddress
          ? await getWalletData(temporaryAccount, network as Network)
          : undefined

        const descriptors = !isImportAddress
          ? [walletData?.externalDescriptor!, walletData?.internalDescriptor!]
          : [
              (typeof temporaryAccount.keys[0].secret === 'object' &&
                temporaryAccount.keys[0].secret.externalDescriptor!) as string
            ]

        setExportContent(descriptors.join('\n'))
      } catch {
        // TODO
      } finally {
        setIsLoading(false)
      }
    }
    getDescriptors()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function exportDescriptors() {
    if (!account) return
    const date = new Date().toISOString().slice(0, -5)
    const ext = 'txt'
    const filename = `${t('export.file.name.descriptors')}_${accountId}_${date}.${ext}`
    shareFile({
      filename,
      fileContent: exportContent,
      dialogTitle: t('export.file.save'),
      mimeType: `text/plain`
    })
  }

  if (!account) return <Redirect href="/" />

  const descriptors = exportContent.split('\n').filter(Boolean)

  return (
    <ScrollView style={{ width: '100%' }}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSHStack gap="sm">
              <SSText uppercase>{account.name}</SSText>
              {account.policyType === 'watchonly' && (
                <SSIconEyeOn stroke="#fff" height={16} width={16} />
              )}
            </SSHStack>
          ),
          headerRight: undefined
        }}
      />
      <SSVStack style={{ padding: 20 }} gap="lg">
        <SSText center uppercase color="muted">
          {t('account.export.descriptors')}
        </SSText>
        {isLoading ? (
          <SSText center color="muted">
            {t('common.loadingX', { x: 'descriptors...' })}
          </SSText>
        ) : descriptors.length > 0 ? (
          <>
            <SSHStack gap="sm" style={{ justifyContent: 'space-between' }}>
              <SSRadioButton
                variant="outline"
                label="Together"
                selected={!showSeparate}
                onPress={() => setShowSeparate(false)}
                style={{ width: '48%' }}
              />
              <SSRadioButton
                variant="outline"
                label="Separate"
                selected={showSeparate}
                onPress={() => setShowSeparate(true)}
                style={{ width: '48%' }}
              />
            </SSHStack>
            {showSeparate ? (
              <SSVStack gap="md">
                {descriptors.map((descriptor, index) => (
                  <View key={index} style={{ alignItems: 'center' }}>
                    <View
                      style={{
                        backgroundColor: Colors.white,
                        padding: 16,
                        borderRadius: 2
                      }}
                    >
                      <SSQRCode
                        value={descriptor}
                        size={150}
                        color={Colors.black}
                        backgroundColor={Colors.white}
                      />
                    </View>
                    <SSText color="muted" size="sm" style={{ marginTop: 8 }}>
                      {index === 0 ? 'External' : 'Internal'}{' '}
                      {t('common.descriptor')}
                    </SSText>
                  </View>
                ))}
              </SSVStack>
            ) : (
              <View style={{ alignItems: 'center' }}>
                <View
                  style={{
                    backgroundColor: Colors.white,
                    padding: 16,
                    borderRadius: 2
                  }}
                >
                  <SSQRCode
                    value={exportContent}
                    size={250}
                    color={Colors.black}
                    backgroundColor={Colors.white}
                  />
                </View>
              </View>
            )}
            <View
              style={{
                padding: 10,
                backgroundColor: Colors.gray[950],
                borderRadius: 5
              }}
            >
              <SSText color="white" size="md" type="mono">
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
              onPress={exportDescriptors}
            />
          </>
        ) : (
          <SSText center color="muted">
            {t('account.descriptors.noAvailable')}
          </SSText>
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
