import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { ScrollView } from 'react-native'

import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { useAccountsStore } from '@/store/accounts'
import { Account } from '@/types/models/Account'
import { UtxoSearchParams } from '@/types/navigation/searchParams'

import SSLabelInput from '@/components/SSLabelInput'
import { Utxo } from '@/types/models/Utxo'
import { getUtxoOutpoint } from '@/utils/utxo'
import SSHStack from '@/layouts/SSHStack'

export default function SSTxLabel() {
  const { id: accountId, txid, vout } = useLocalSearchParams<UtxoSearchParams>()

  const [utxo, setUtxoLabel] = useAccountsStore((state) => [
    state.accounts
      .find((account: Account) => account.name === accountId)
      ?.utxos.find((u: Utxo) => u.txid === txid && u.vout === Number(vout)),
    state.setUtxoLabel
  ])

  if (!utxo) return <Redirect href="/" />

  function updateLabel(label: string) {
    setUtxoLabel(accountId, txid, Number(vout), label)
    router.back()
  }

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText>Edit UTXO Label</SSText>
        }}
      />
      <SSVStack style={{ padding: 20 }}>
        <SSVStack gap="none">
          <SSHStack style={{ alignItems: 'flex-start'}}>
          <SSText>TXID</SSText>
          <SSText color='muted'>{txid}</SSText>
          </SSHStack>
          <SSHStack>
          <SSText>OUT</SSText>
          <SSText color='muted'>{vout}</SSText>
          </SSHStack>
        </SSVStack>
        <SSLabelInput label={utxo.label || ''} onUpdateLabel={updateLabel} />
      </SSVStack>
    </ScrollView>
  )
}
