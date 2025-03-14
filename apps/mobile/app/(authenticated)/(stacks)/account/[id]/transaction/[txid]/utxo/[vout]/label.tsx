import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { ScrollView } from 'react-native'

import SSLabelInput from '@/components/SSLabelInput'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type UtxoSearchParams } from '@/types/navigation/searchParams'

export default function SSTxLabel() {
  const { id: accountId, txid, vout } = useLocalSearchParams<UtxoSearchParams>()

  const [utxo, setUtxoLabel] = useAccountsStore((state) => [
    state.accounts
      .find((account) => account.id === accountId)
      ?.utxos.find((utxo) => utxo.txid === txid && utxo.vout === Number(vout)),
    state.setUtxoLabel
  ])

  function updateLabel(label: string) {
    setUtxoLabel(accountId!, txid!, Number(vout!), label)
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
      <SSVStack style={{ padding: 20 }}>
        <SSVStack gap="none">
          <SSHStack style={{ alignItems: 'flex-start' }}>
            <SSText uppercase>{t('transaction.txid')}</SSText>
            <SSText color="muted">{txid}</SSText>
          </SSHStack>
          <SSHStack>
            <SSText uppercase>{t('transaction.vout')}</SSText>
            <SSText color="muted">{vout}</SSText>
          </SSHStack>
        </SSVStack>
        <SSLabelInput label={utxo.label || ''} onUpdateLabel={updateLabel} />
      </SSVStack>
    </ScrollView>
  )
}
