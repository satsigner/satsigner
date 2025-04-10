import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { ScrollView } from 'react-native'

import SSLabelInput from '@/components/SSLabelInput'
import SSText from '@/components/SSText'
import useNostrLabelSync from '@/hooks/useNostrLabelSync'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type Account } from '@/types/models/Account'
import { type Transaction } from '@/types/models/Transaction'
import { type TxSearchParams } from '@/types/navigation/searchParams'

import { SSTxDetailsHeader } from '.'

function SSTransactionLabel() {
  const { id: accountId, txid } = useLocalSearchParams<TxSearchParams>()

  const { sendAccountLabelsToNostr } = useNostrLabelSync()

  const [account, tx, setTxLabel] = useAccountsStore((state) => [
    state.accounts.find((account: Account) => account.id === accountId),
    state.accounts
      .find((account: Account) => account.id === accountId)
      ?.transactions.find((tx: Transaction) => tx.id === txid),
    state.setTxLabel
  ])

  function updateLabel(label: string) {
    setTxLabel(accountId!, txid!, label)
    // TODO: this does not have the updated label
    sendAccountLabelsToNostr(account!)
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
