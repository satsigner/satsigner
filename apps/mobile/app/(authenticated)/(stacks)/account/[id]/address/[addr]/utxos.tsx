import { Redirect, Stack, useLocalSearchParams } from 'expo-router'
import { ScrollView, View } from 'react-native'

import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSUtxoCard from '@/components/SSUtxoCard'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type Account } from '@/types/models/Account'
import { type Address } from '@/types/models/Address'
import { type AddrSearchParams } from '@/types/navigation/searchParams'
import { getUtxoOutpoint } from '@/utils/utxo'

function SSAddressUtxos() {
  const { id: accountId, addr } = useLocalSearchParams<AddrSearchParams>()

  const address = useAccountsStore((state) =>
    state.accounts
      .find((account: Account) => account.name === accountId)
      ?.addresses.find((address: Address) => address.address === addr)
  )

  const utxos = useAccountsStore((state) =>
    state.accounts
      .find((account: Account) => account.name === accountId)
      ?.utxos.filter((utxo) => address?.utxos.includes(getUtxoOutpoint(utxo)))
  )

  if (!addr || !address || !utxos) return <Redirect href="/" />

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('address.transactions')}</SSText>
          )
        }}
      />

      <SSVStack gap="none" style={{ padding: 10 }}>
        <SSSeparator />
        {utxos.map((utxo) => (
          <>
            <View style={{ paddingBottom: 10 }}>
              <SSUtxoCard utxo={utxo} />
            </View>
            <SSSeparator />
          </>
        ))}
      </SSVStack>
    </ScrollView>
  )
}

export default SSAddressUtxos
