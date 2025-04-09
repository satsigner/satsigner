import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { ScrollView } from 'react-native'

import SSLabelInput from '@/components/SSLabelInput'
import SSText from '@/components/SSText'
import useNostrLabelSync from '@/hooks/useNostrLabelSync'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type Account } from '@/types/models/Account'
import { type UtxoSearchParams } from '@/types/navigation/searchParams'

function SSUtxoLabel() {
  const { id: accountId, txid, vout } = useLocalSearchParams<UtxoSearchParams>()

  const { sendAccountLabelsToNostr } = useNostrLabelSync()

  const [account, utxo, setUtxoLabel] = useAccountsStore((state) => [
    state.accounts.find((account: Account) => account.id === accountId),
    state.accounts
      .find((account) => account.id === accountId)
      ?.utxos.find((utxo) => utxo.txid === txid && utxo.vout === Number(vout)),
    state.setUtxoLabel
  ])

  function updateLabel(label: string) {
    setUtxoLabel(accountId!, txid!, Number(vout!), label)
    sendAccountLabelsToNostr(account!)
    router.back()
  }

  if (!utxo || !txid || !accountId || !vout) return <Redirect href="/" />

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText>{t('transaction.edit.label.utxo')}</SSText>
        }}
      />
      <SSVStack gap="none" style={{ padding: 20 }}>
        <SSVStack gap="sm">
          <SSVStack gap="none">
            <SSText uppercase>{t('transaction.txid')}</SSText>
            <SSText color="muted">{txid}</SSText>
          </SSVStack>
          <SSVStack gap="none">
            <SSText uppercase>{t('utxo.vout')}</SSText>
            <SSText color="muted">{vout}</SSText>
          </SSVStack>
        </SSVStack>
        <SSLabelInput label={utxo.label || ''} onUpdateLabel={updateLabel} />
      </SSVStack>
    </ScrollView>
  )
}

export default SSUtxoLabel
