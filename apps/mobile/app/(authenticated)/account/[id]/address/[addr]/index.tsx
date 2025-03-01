import { Stack, useLocalSearchParams } from 'expo-router'
import { ScrollView } from 'react-native'

import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { useAccountsStore } from '@/store/accounts'
import { type AddrSearchParams } from '@/types/navigation/searchParams'
import SSMainLayout from '@/layouts/SSMainLayout'

function AddressDetails() {
  const { id: accountId, addr } = useLocalSearchParams<AddrSearchParams>()

  const [address] = useAccountsStore((state) => [
    state.accounts
      .find((account) => account.name === accountId)
      ?.addresses.find((address) => {
        // TODO: remove keychain after fixing the internal address BUG
        return address.address === addr && address.keychain === 'internal'
      })
  ])

  if (! accountId || ! addr)
    <SSText>NOT FOUND</SSText>

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText>ADDRESS DETAILS</SSText>
        }}
      />
      <SSMainLayout>
        <SSText weight='bold'>Address</SSText>
        <SSText>{address?.address}</SSText>
        <SSText weight='bold'>Balance</SSText>
        <SSText>{address?.summary.balance}</SSText>
        <SSText weight='bold'>Total transactions</SSText>
        <SSText>{address?.summary.transactions}</SSText>
        <SSText weight='bold'>Total utxos</SSText>
        <SSText>{address?.summary.utxos}</SSText>
      </SSMainLayout>
    </ScrollView>
  )
}

export default AddressDetails
