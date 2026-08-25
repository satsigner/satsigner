import { Redirect, Stack, useLocalSearchParams } from 'expo-router'

import SSText from '@/components/SSText'
import SSVerifyMessage from '@/components/SSVerifyMessage'
import SSScrollView from '@/layouts/SSScrollView'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { resolveExplorerAddressParam } from '@/utils/parse'

function ExplorerAddressVerifyMessage() {
  const { address: addressParam } = useLocalSearchParams<{
    address: string
  }>()
  const resolvedAddress = resolveExplorerAddressParam(addressParam)
  const selectedNetwork = useBlockchainStore((state) => state.selectedNetwork)

  if (!resolvedAddress) {
    return <Redirect href="/explorer/address" />
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
      <SSVerifyMessage address={resolvedAddress} network={selectedNetwork} />
    </SSScrollView>
  )
}

export default ExplorerAddressVerifyMessage
