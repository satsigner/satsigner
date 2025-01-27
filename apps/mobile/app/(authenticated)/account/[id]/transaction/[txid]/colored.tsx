import { TxSearchParams } from "@/types/navigation/searchParams"
import { useAccountsStore } from '@/store/accounts'
import { Stack, useLocalSearchParams } from "expo-router"
import SSText from "@/components/SSText"
import { ScrollView } from "react-native"
import { i18n } from "@/locales"
import SSVStack from "@/layouts/SSVStack"
import { ColoredTransaction } from "@/utils/coloredTx"

export default function TxColored() {
  const { id: accountId, txid } = useLocalSearchParams<TxSearchParams>()

  const tx = useAccountsStore((state) =>
    state.accounts
      .find((account) => account.name === accountId)
      ?.transactions.find((tx) => tx.id === txid)
  )

  if (! txid || !accountId || !tx || !tx.raw)
    throw new Error(`${txid} not found`)

  const raw = tx.raw.map((byte) => byte.toString(16).padStart(2, '0')).join()
  const coloredTx = ColoredTransaction.fromHex(raw)

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText>
            {i18n.t('txDetails.txDecoded')}
          </SSText>
        }}
      />
      <SSVStack style={{ padding: 20 }}>
        <SSText type="mono">
        {tx.raw || 'nonthing'}
        </SSText>
      </SSVStack>
    </ScrollView>
  )
}
