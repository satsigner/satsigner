import { Slot, Stack, useLocalSearchParams } from 'expo-router'

import { SSIconEyeOn } from '@/components/icons'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import { useAccountsStore } from '@/store/accounts'
import { type AccountSearchParams } from '@/types/navigation/searchParams'

export default function SignAndSendLayout() {
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const account = useAccountsStore(
    (state) => state.accounts.find((account) => account.id === id)!
  )

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSHStack gap="sm">
              <SSText uppercase>{account.name}</SSText>
              {account.policyType === 'watchonly' && (
                <SSIconEyeOn stroke="#fff" height={16} width={16} />
              )}
            </SSHStack>
          ),
          headerRight: undefined
        }}
      />
      <Slot />
    </>
  )
}
