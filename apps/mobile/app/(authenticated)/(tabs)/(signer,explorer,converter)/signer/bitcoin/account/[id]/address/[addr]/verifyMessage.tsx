import { Redirect, Stack, useLocalSearchParams } from 'expo-router'
import { useShallow } from 'zustand/react/shallow'

import SSText from '@/components/SSText'
import SSVerifyMessage from '@/components/SSVerifyMessage'
import SSScrollView from '@/layouts/SSScrollView'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type AddrSearchParams } from '@/types/navigation/searchParams'

function AddressVerifyMessage() {
  const { id: accountId, addr } = useLocalSearchParams<AddrSearchParams>()

  const [account, address] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((account) => account.id === accountId),
      state.accounts
        .find((account) => account.id === accountId)
        ?.addresses.find((address) => address.address === addr)
    ])
  )

  if (!account || !address || !addr) {
    return <Redirect href="/" />
  }

  return (
    <SSScrollView keyboardDismissMode="interactive">
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('address.verifyMessage.title')}</SSText>
          )
        }}
      />
      <SSVerifyMessage address={addr} network={account.network} />
    </SSScrollView>
  )
}

export default AddressVerifyMessage
