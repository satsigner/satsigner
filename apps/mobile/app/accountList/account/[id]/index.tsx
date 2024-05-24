import { Image } from 'expo-image'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { ScrollView } from 'react-native'

import SSActionButton from '@/components/SSActionButton'
import SSBackgroundGradient from '@/components/SSBackgroundGradient'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSTransactionCard from '@/components/SSTransactionCard'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountStore } from '@/store/accounts'
import { Colors } from '@/styles'

type AccountSearchParams = {
  id: string
}

export default function Account() {
  const accountStore = useAccountStore()
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{accountStore.currentAccount.name}</SSText>
          )
        }}
      />
      <SSBackgroundGradient orientation="horizontal">
        <SSVStack itemsCenter>
          <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
            <SSText size="3xl" color="white" weight="light">
              3000
            </SSText>
            <SSText size="xl" color="muted">
              {i18n.t('bitcoin.sats').toLowerCase()}
            </SSText>
          </SSHStack>
          <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
            <SSText color="muted">2.19</SSText>
            <SSText size="xs" style={{ color: Colors.gray[500] }}>
              USD
            </SSText>
          </SSHStack>
          <SSVStack gap="none">
            <SSSeparator color="gradient" />
            <SSHStack justifyEvenly gap="none">
              <SSActionButton
                onPress={() =>
                  router.navigate(
                    `/accountList/account/${id}/signAndSend/selectUtxoList`
                  )
                }
                style={{
                  width: '40%',
                  borderRightWidth: 1,
                  borderRightColor: Colors.gray[700]
                }}
              >
                <SSText uppercase>{i18n.t('account.signAndSend')}</SSText>
              </SSActionButton>
              <SSActionButton onPress={() => {}} style={{ width: '20%' }}>
                <Image
                  style={{ width: 18, height: 13 }}
                  source={require('@/assets/icons/camera.svg')}
                />
              </SSActionButton>
              <SSActionButton
                onPress={() => {}}
                style={{
                  width: '40%',
                  borderLeftWidth: 1,
                  borderLeftColor: Colors.gray[700]
                }}
              >
                <SSText uppercase>{i18n.t('account.newInvoice')}</SSText>
              </SSActionButton>
            </SSHStack>
            <SSSeparator color="gradient" />
          </SSVStack>
          <SSHStack>
            <SSVStack>
              <SSText center>3</SSText>
              <SSText center>
                {i18n.t('accountList.totalTransactions.0')}
                {'\n'}
                {i18n.t('accountList.totalTransactions.1')}
              </SSText>
            </SSVStack>
            <SSVStack>
              <SSText center>4</SSText>
              <SSText center>
                {i18n.t('accountList.childAccounts.0')}
                {'\n'}
                {i18n.t('accountList.childAccounts.1')}
              </SSText>
            </SSVStack>
            <SSVStack>
              <SSText center>3</SSText>
              <SSText center>
                {i18n.t('accountList.spendableOutputs.0')}
                {'\n'}
                {i18n.t('accountList.spendableOutputs.1')}
              </SSText>
            </SSVStack>
            <SSVStack>
              <SSText center>0</SSText>
              <SSText center>
                {i18n.t('accountList.satsInMempool.0')}
                {'\n'}
                {i18n.t('accountList.satsInMempool.1')}
              </SSText>
            </SSVStack>
          </SSHStack>
        </SSVStack>
      </SSBackgroundGradient>
      <SSMainLayout>
        <SSHStack justifyBetween>
          <Image
            style={{ width: 18, height: 22 }}
            source={require('@/assets/icons/refresh.svg')}
          />
          <SSText color="muted">
            {i18n.t('account.parentAccountActivity')}
          </SSText>
          <Image
            style={{ width: 11.6, height: 6 }}
            source={require('@/assets/icons/chevron-down.svg')}
          />
        </SSHStack>
        <ScrollView>
          <SSVStack style={{ marginTop: 16 }}>
            {accountStore.currentAccount.transactions.map((transaction) => (
              <SSVStack key={transaction.id}>
                <SSSeparator
                  key={`separator-${transaction.id}`}
                  color="grayDark"
                />
                <SSTransactionCard
                  key={transaction.id}
                  transaction={transaction}
                  blockHeight={840000}
                />
              </SSVStack>
            ))}
          </SSVStack>
        </ScrollView>
      </SSMainLayout>
    </>
  )
}
