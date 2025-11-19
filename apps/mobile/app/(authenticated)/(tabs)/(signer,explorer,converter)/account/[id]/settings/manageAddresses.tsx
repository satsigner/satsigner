import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { ScrollView } from 'react-native'

import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatNumber } from '@/utils/format'

export default function ManageAccountAddresses() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()

  const account = useAccountsStore((state) =>
    state.accounts.find((_account) => _account.id === accountId)
  )

  const [currencyUnit, setSatsUnit] = useState<'sats' | 'btc'>('sats')

  const isMultiAddressWatchOnly = useMemo(() => {
    return (
      account &&
      account.keys.length > 1 &&
      account.keys[0].creationType === 'importAddress'
    )
  }, [account])

  const formatAmount = useCallback(
    function (amount: number) {
      return currencyUnit === 'sats'
        ? formatNumber(amount)
        : formatNumber(amount / 100_000_000, 8)
    },
    [currencyUnit]
  )

  function handleShowAddAddress() {
    // TODO:
  }

  function handleDeleteAddress() {
    // TODO:
  }

  if (!account || !isMultiAddressWatchOnly) return <Redirect href="/" />

  return (
    <SSMainLayout style={{ marginBottom: 20 }}>
      <ScrollView>
        <SSVStack gap="lg">
          <SSText uppercase size="lg" weight="bold">
            Manage addresses
          </SSText>
          <SSVStack gap="sm">
            <SSText size="md" weight="bold">
              Currency display options:
            </SSText>
            <SSCheckbox
              selected={currencyUnit === 'sats'}
              onPress={() => setSatsUnit('sats')}
              label="SATS"
            />
            <SSCheckbox
              selected={currencyUnit === 'btc'}
              onPress={() => setSatsUnit('btc')}
              label="BTC"
            />
          </SSVStack>
          <SSVStack gap="lg">
            {account.addresses.map((address, index) => {
              return (
                <SSVStack gap="sm" key={address.address}>
                  <SSText uppercase weight="bold">
                    {`Address #${index + 1}`}
                  </SSText>
                  <SSAddressDisplay address={address.address} />
                  <SSVStack gap="none">
                    <SSText>
                      Current balance:{' '}
                      <SSStyledSatText
                        amount={address.summary.balance}
                        useZeroPadding
                        textSize="sm"
                        noColor
                      />
                    </SSText>
                    {address.summary.satsInMempool > 0 && (
                      <SSText>
                        Unconfirmed funds in mempool:{' '}
                        {formatAmount(address.summary.satsInMempool)}
                      </SSText>
                    )}
                    <SSText>
                      Total UTXOs:{' '}
                      <SSText weight="bold">{address.summary.utxos}</SSText>
                    </SSText>
                    <SSText>
                      Total Transactions:{' '}
                      <SSText weight="bold">
                        {address.summary.transactions}
                      </SSText>
                    </SSText>
                    <SSText>
                      Label:{' '}
                      {address.label ? (
                        <SSText weight="bold">{address.label}</SSText>
                      ) : (
                        <SSText color="muted">{t('common.noLabel')}</SSText>
                      )}
                    </SSText>
                  </SSVStack>
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
            label="Add address"
            variant="outline"
            uppercase
            onPress={handleShowAddAddress}
          />
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}
