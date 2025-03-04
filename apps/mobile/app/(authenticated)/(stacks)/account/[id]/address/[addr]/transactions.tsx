import { Redirect, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'

import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSTransactionCard from '@/components/SSTransactionCard'
import SSVStack from '@/layouts/SSVStack'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { type Account } from '@/types/models/Account'
import { type Address } from '@/types/models/Address'
import { type AddrSearchParams } from '@/types/navigation/searchParams'
import { t } from '@/locales'

function SSAddressTransaction() {
  const { id: accountId, addr } = useLocalSearchParams<AddrSearchParams>()

  const address = useAccountsStore((state) =>
    state.accounts
      .find((account: Account) => account.name === accountId)
      ?.addresses.find((address: Address) => address.address === addr)
  )

  const transactions = useAccountsStore((state) =>
    state.accounts
      .find((account: Account) => account.name === accountId)
      ?.transactions.filter((tx) => address?.transactions.includes(tx.id))
  )

  const getBlockchainHeight = useBlockchainStore(
    (state) => state.getBlockchainHeight
  )

  const [blockchainHeight, setBlockchainHeight] = useState<number>(0)

  async function refreshBlockchainHeight() {
    const height = await getBlockchainHeight()
    console.log(height)
    setBlockchainHeight(height)
  }

  useEffect(() => {
    refreshBlockchainHeight()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!addr || !address || !transactions) return <Redirect href="/" />

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>
            {t('address.transactions')}
          </SSText>
        }}
      />

      <SSVStack gap="none" style={{ padding: 10 }}>
        <SSSeparator />
        {transactions.map((tx) => (
          <>
            <View style={{ paddingBottom: 10 }}>
              <SSTransactionCard
                transaction={tx}
                key={tx.id}
                blockHeight={blockchainHeight}
                fiatCurrency="USD"
                btcPrice={0}
                link={`/account/${accountId}/transaction/${tx.id}`}
                expand={false}
              />
            </View>
            <SSSeparator />
          </>
        ))}

      </SSVStack>
    </ScrollView>
  )
}

export default SSAddressTransaction
