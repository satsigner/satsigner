import { Slot, Stack, useLocalSearchParams } from 'expo-router'

import { SSIconEyeOn } from '@/components/icons'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import { useAccountsStore } from '@/store/accounts'
import { type AccountSearchParams } from '@/types/navigation/searchParams'

function resolveParamId(id: string | string[] | undefined): string | undefined {
  if (Array.isArray(id)) {
    return id[0]
  }
  return id
}

export default function TransactionLayout() {
  const params = useLocalSearchParams<AccountSearchParams>()
  const id = resolveParamId(params.id)

  const account = useAccountsStore((state) =>
    id ? state.accounts.find((entry) => entry.id === id) : undefined
  )

  if (!account) {
    return <Slot />
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: undefined,
          headerTitle: () => (
            <SSHStack gap="sm">
              <SSText uppercase>{account.name}</SSText>
              {account.policyType === 'watchonly' ? (
                <SSIconEyeOn stroke="#fff" height={16} width={16} />
              ) : null}
            </SSHStack>
          )
        }}
      />
      <Slot />
    </>
  )
}
