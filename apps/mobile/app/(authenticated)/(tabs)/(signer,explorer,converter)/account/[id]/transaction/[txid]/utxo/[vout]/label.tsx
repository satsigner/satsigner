import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { ScrollView } from 'react-native'

import SSLabelInput from '@/components/SSLabelInput'
import SSText from '@/components/SSText'
import useNostrSync from '@/hooks/useNostrSync'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type UtxoSearchParams } from '@/types/navigation/searchParams'
import { type Label } from '@/utils/bip329'

function UtxoLabel() {
  const { id: accountId, txid, vout } = useLocalSearchParams<UtxoSearchParams>()

  const { sendLabelsToNostr } = useNostrSync()

  const [utxo, setUtxoLabel] = useAccountsStore((state) => [
    state.accounts
      .find((account) => account.id === accountId)
      ?.utxos.find((utxo) => utxo.txid === txid && utxo.vout === Number(vout)),
    state.setUtxoLabel
  ])

  function updateLabel(label: string) {
    const updatedAccount = setUtxoLabel(accountId!, txid!, Number(vout!), label)

    const singleLabelData: Label = {
      label,
      ref: `${txid}:${vout}`,
      type: 'output',
      spendable: true
    }

    if (updatedAccount?.nostr?.autoSync) {
      sendLabelsToNostr(updatedAccount, singleLabelData)
    }
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

export default UtxoLabel
