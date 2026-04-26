import { router, Stack, useLocalSearchParams } from 'expo-router'

import SSButton from '@/components/SSButton'
import SSFingerprint from '@/components/SSFingerprint'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { Colors } from '@/styles'
import { Account } from '@/types/models/Account'
import { getScriptVersionDisplayName } from '@/utils/scripts'

export function WalletCreated() {
  const { id } = useLocalSearchParams<{ id: Account['id'] }>()
  const account = useAccountsStore((state) =>
    state.accounts.find((_account) => _account.id === id)
  )
  const key = account?.keys[0]

  function handleDissmisAccountAdded() {
    router.dismissAll()
    router.navigate(`/signer/bitcoin/account/${id}`)
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{account?.name}</SSText>
        }}
      />
      <SSVStack>
        {key && (
          <SSVStack style={{ marginVertical: 32, width: '100%' }}>
            <SSVStack itemsCenter gap="xs">
              <SSText color="white" size="2xl">
                {name}
              </SSText>
              <SSText color="muted" size="lg">
                {t('account.added')}
              </SSText>
            </SSVStack>
            <SSSeparator />
            <SSHStack justifyEvenly style={{ alignItems: 'flex-start' }}>
              <SSVStack itemsCenter>
                <SSText style={{ color: Colors.gray[500] }}>
                  {t('account.script')}
                </SSText>
                <SSText size="md" color="muted" center>
                  {key.scriptVersion
                    ? getScriptVersionDisplayName(key.scriptVersion)
                    : '-'}
                </SSText>
              </SSVStack>
              <SSVStack itemsCenter>
                <SSText style={{ color: Colors.gray[500] }}>
                  {t('account.fingerprint')}
                </SSText>
                <SSFingerprint fingerprint={key.fingerprint} />
              </SSVStack>
            </SSHStack>
            <SSSeparator />
            <SSVStack itemsCenter>
              <SSText style={{ color: Colors.gray[500] }}>
                {t('account.derivationPath')}
              </SSText>
              <SSText size="md" color="muted">
                {key.derivationPath || '-'}
              </SSText>
            </SSVStack>
          </SSVStack>
        )}
        {!key && (
          <SSVStack>
            <SSText>Account creation failed.</SSText>
          </SSVStack>
        )}
        <SSButton
          label={t('common.ok')}
          onPress={handleDissmisAccountAdded}
          variant="secondary"
        />
      </SSVStack>
    </SSMainLayout>
  )
}
