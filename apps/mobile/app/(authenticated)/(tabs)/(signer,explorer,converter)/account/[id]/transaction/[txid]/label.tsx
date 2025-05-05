import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { ScrollView } from 'react-native'

import SSLabelInput from '@/components/SSLabelInput'
import SSText from '@/components/SSText'
import useNostrSync from '@/hooks/useNostrSync'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type Account } from '@/types/models/Account'
import { type Transaction } from '@/types/models/Transaction'
import { type TxSearchParams } from '@/types/navigation/searchParams'

import { SSTxDetailsHeader } from '.'

function SSTransactionLabel() {
  const { id: accountId, txid } = useLocalSearchParams<TxSearchParams>()

  const { sendAccountLabelsToNostr } = useNostrSync()

  const [tx, setTxLabel] = useAccountsStore((state) => [
    state.accounts
      .find((account: Account) => account.id === accountId)
      ?.transactions.find((tx: Transaction) => tx.id === txid),
    state.setTxLabel
  ])

  function updateLabel(label: string) {
    const updatedAccount = setTxLabel(accountId!, txid!, label)
    sendAccountLabelsToNostr(updatedAccount)
    router.back()
  }

  if (!tx || !accountId) return <Redirect href="/" />

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText>{t('transaction.edit.label.transaction')}</SSText>
          )
        }}
      />
      <SSVStack style={{ padding: 20 }}>
        <SSTxDetailsHeader tx={tx} />
        <SSLabelInput label={tx.label || ''} onUpdateLabel={updateLabel} />
      </SSVStack>
    </ScrollView>
  )
}

export default SSTransactionLabel
