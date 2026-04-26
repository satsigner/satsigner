import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSRadioButton from '@/components/SSRadioButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { ARK_SERVERS, ARK_SUPPORTED_NETWORKS } from '@/constants/arkServers'
import { useArkAccountBuilder } from '@/hooks/useArkAccountBuilder'
import { useArkBitcoinAccounts } from '@/hooks/useArkBitcoinAccounts'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { Network } from '@/types/settings/blockchain'
import { arkNetworkLabel } from '@/utils/ark'

export default function ArkAccountAddPage() {
  const router = useRouter()
  const {
    bitcoinAccountId,
    createAccount,
    createBitcoinAccount,
    clearBuilder,
    name,
    network,
    serverId,
    setBitcoinAccountId,
    setCreateBitcoinAccount,
    setName,
    setNetwork,
    setServerId
  } = useArkAccountBuilder()

  const [isCreating, setIsCreating] = useState(false)
  const bitcoinAccounts = useArkBitcoinAccounts(network)

  const servers = ARK_SERVERS[network]
  const hasBitcoinAccounts = bitcoinAccounts.length > 0
  const canSubmit =
    !isCreating &&
    (createBitcoinAccount || bitcoinAccountId !== null) &&
    servers.length > 0

  function handleNetworkChange(next: Network) {
    setNetwork(next)
    const [nextServer] = ARK_SERVERS[next]
    if (nextServer) {
      setServerId(nextServer.id)
    }
    setBitcoinAccountId(null)
    setCreateBitcoinAccount(false)
  }

  function handleSelectBitcoinAccount(id: string) {
    setCreateBitcoinAccount(false)
    setBitcoinAccountId(id)
  }

  function handleSelectAutoCreate() {
    setBitcoinAccountId(null)
    setCreateBitcoinAccount(true)
  }

  async function handleCreate() {
    setIsCreating(true)
    try {
      const account = await createAccount()
      router.replace({
        params: { id: account.id },
        pathname: '/signer/ark/account/[id]'
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('ark.error.create')
      toast.error(message)
    } finally {
      setIsCreating(false)
    }
  }

  function handleBack() {
    clearBuilder()
    router.back()
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('ark.account.create')}</SSText>
          )
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack gap="lg" style={styles.container}>
          <SSVStack gap="sm">
            <SSText uppercase>{t('ark.account.name')}</SSText>
            <SSTextInput
              value={name}
              onChangeText={setName}
              placeholder={t('ark.account.namePlaceholder')}
            />
          </SSVStack>
          <SSVStack gap="sm">
            <SSText uppercase>{t('ark.account.network')}</SSText>
            <SSVStack gap="xs">
              {ARK_SUPPORTED_NETWORKS.map((n) => (
                <SSRadioButton
                  key={n}
                  label={arkNetworkLabel(n)}
                  selected={network === n}
                  onPress={() => handleNetworkChange(n)}
                />
              ))}
            </SSVStack>
          </SSVStack>
          <SSVStack gap="sm">
            <SSText uppercase>{t('ark.account.server')}</SSText>
            <SSVStack gap="xs">
              {servers.map((server) => (
                <SSRadioButton
                  key={server.id}
                  label={server.name}
                  selected={serverId === server.id}
                  onPress={() => setServerId(server.id)}
                />
              ))}
            </SSVStack>
          </SSVStack>
          <SSVStack gap="sm">
            <SSText uppercase>{t('ark.account.bitcoinSource')}</SSText>
            <SSText color="muted" size="sm">
              {t('ark.account.bitcoinSourceDescription')}
            </SSText>
            {hasBitcoinAccounts && (
              <SSVStack gap="xs">
                <SSText color="muted" size="xs" uppercase>
                  {t('ark.account.existingWallet')}
                </SSText>
                {bitcoinAccounts.map((account) => (
                  <SSRadioButton
                    key={account.id}
                    label={account.name}
                    selected={bitcoinAccountId === account.id}
                    onPress={() => handleSelectBitcoinAccount(account.id)}
                  />
                ))}
              </SSVStack>
            )}
            {!hasBitcoinAccounts && (
              <View style={styles.notice}>
                <SSText color="muted" size="sm">
                  {t('ark.account.noBitcoinAccounts')}
                </SSText>
              </View>
            )}
            <SSRadioButton
              label={t('ark.account.createBitcoinToggle')}
              selected={createBitcoinAccount}
              onPress={handleSelectAutoCreate}
            />
          </SSVStack>
          <SSVStack gap="sm" style={styles.actions}>
            <SSButton
              label={
                isCreating ? t('ark.account.creating') : t('ark.account.create')
              }
              onPress={handleCreate}
              variant="gradient"
              gradientType="special"
              loading={isCreating}
              disabled={!canSubmit}
            />
            <SSButton
              label={t('common.back')}
              onPress={handleBack}
              variant="subtle"
              disabled={isCreating}
            />
          </SSVStack>
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  actions: {
    paddingTop: 12
  },
  container: {
    paddingBottom: 60,
    paddingTop: 20
  },
  notice: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[800],
    borderRadius: 8,
    borderWidth: 1,
    padding: 12
  }
})
