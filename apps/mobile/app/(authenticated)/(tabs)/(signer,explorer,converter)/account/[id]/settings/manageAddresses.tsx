import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useMemo } from 'react'
import { ScrollView } from 'react-native'

import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type AccountSearchParams } from '@/types/navigation/searchParams'

export default function ManageAccountAddresses() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()

  const account = useAccountsStore((state) =>
    state.accounts.find((_account) => _account.id === accountId)
  )

  const isMultiAddressWatchOnly = useMemo(() => {
    return (
      account &&
      account.keys.length > 1 &&
      account.keys[0].creationType === 'importAddress'
    )
  }, [account])

  function handleShowAddAddress() {
    // TODO: show input to add a new address, store it as new key and address
    // object as well.
  }

  function handleDeleteAddress() {
    // TODO: remove the secret key associated with that address and the address
    // object as well.
  }

  if (!account || !isMultiAddressWatchOnly) return <Redirect href="/" />

  return (
    <SSMainLayout style={{ marginBottom: 20 }}>
      <ScrollView>
        <SSVStack gap="lg">
          <SSText uppercase size="lg" weight="bold">
            Manage addresses
          </SSText>
          <SSVStack>
            {account.addresses.map((address, index) => {
              return (
                <SSVStack gap="sm">
                  <SSText uppercase weight="bold">
                    {`Address #${index + 1}`}
                  </SSText>
                  <SSAddressDisplay address={address.address} />
                  <SSText color="muted">
                    {address.label || t('common.noLabel')}
                  </SSText>
                  <SSHStack gap="sm">
                    <SSButton
                      style={{ width: 'auto', flexGrow: 1 }}
                      label="VIEW"
                      onPress={() =>
                        router.navigate(
                          `/account/${accountId}/address/${address.address}`
                        )
                      }
                    />
                    <SSButton
                      style={{ width: 'auto', flexGrow: 1 }}
                      label="DELETE"
                      variant="danger"
                      onPress={handleDeleteAddress}
                    />
                  </SSHStack>
                </SSVStack>
              )
            })}
          </SSVStack>
          <SSButton
            variant="outline"
            uppercase
            label="Add address"
            onPress={handleShowAddAddress}
          />
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}
