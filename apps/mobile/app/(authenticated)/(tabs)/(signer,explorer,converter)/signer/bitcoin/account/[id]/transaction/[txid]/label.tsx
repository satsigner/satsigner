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
import { type Label } from '@/utils/bip329'

import { SSTxDetailsHeader } from '.'

function TransactionLabel() {
  const { id: accountId, txid } = useLocalSearchParams<TxSearchParams>()

  const { sendLabelsToNostr } = useNostrSync()

  const [tx, setTxLabel] = useAccountsStore((state) => [
    state.accounts
      .find((account: Account) => account.id === accountId)
      ?.transactions.find((tx: Transaction) => tx.id === txid),
    state.setTxLabel
  ])

  function updateLabel(label: string) {
    const updatedAccount = setTxLabel(accountId!, txid!, label)

    const singleLabelData: Label = {
      label,
      ref: txid!,
      type: 'tx',
      spendable: true
    }

    if (updatedAccount?.nostr?.autoSync) {
      sendLabelsToNostr(updatedAccount, singleLabelData)
    }
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

export default TransactionLabel
