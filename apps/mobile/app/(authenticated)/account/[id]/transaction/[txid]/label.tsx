import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { ScrollView } from 'react-native'

import SSLabelInput from '@/components/SSLabelInput'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { Account } from '@/types/models/Account'
import { Transaction } from '@/types/models/Transaction'
import { TxSearchParams } from '@/types/navigation/searchParams'

import { SSTxDetailsHeader } from '.'

export default function SSTxLabel() {
  const { id: accountId, txid } = useLocalSearchParams<TxSearchParams>()

  const [tx, setTxLabel] = useAccountsStore((state) => [
    state.accounts
      .find((account: Account) => account.name === accountId)
      ?.transactions.find((tx: Transaction) => tx.id === txid),
    state.setTxLabel
  ])

  if (!tx) return <Redirect href="/" />

  function updateLabel(label: string) {
    setTxLabel(accountId, txid, label)
    router.back()
  }

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText>{i18n.t('txDetails.labelEdit')}</SSText>
        }}
      />
      <SSVStack style={{ padding: 20 }}>
        <SSTxDetailsHeader tx={tx} />
        <SSLabelInput label={tx.label || ''} onUpdateLabel={updateLabel} />
      </SSVStack>
    </ScrollView>
  )
}
