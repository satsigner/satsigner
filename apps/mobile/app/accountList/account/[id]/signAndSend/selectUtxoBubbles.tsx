import { Stack } from 'expo-router'

import SSText from '@/components/SSText'
import { useAccountStore } from '@/store/accounts'

export default function SelectUtxoBubbles() {
  const accountStore = useAccountStore()

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{accountStore.currentAccount.name}</SSText>
          )
        }}
      />
    </>
  )
}
