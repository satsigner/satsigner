import { toOutputScript } from 'bitcoinjs-lib/src/address'
import { toASM } from 'bitcoinjs-lib/src/script'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, TouchableOpacity } from 'react-native'

import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSLabelDetails from '@/components/SSLabelDetails'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type AddrSearchParams } from '@/types/navigation/searchParams'
import { bitcoinjsNetwork } from '@/utils/bitcoin'
import { formatNumber } from '@/utils/format'

function AddressDetails() {
  const { id: accountId, addr } = useLocalSearchParams<AddrSearchParams>()
  const [script, setScript] = useState('')

  const [account, address] = useAccountsStore((state) => [
    state.accounts.find((account) => account.name === accountId),
    state.accounts
      .find((account) => account.name === accountId)
      ?.addresses.find((address) => {
        return address.address === addr
      })
  ])

  useEffect(() => {
    if (!address) return
    try {
      const rawScript = toOutputScript(
        address.address,
        bitcoinjsNetwork(address.network || 'signet')
      )
      setScript(toASM(rawScript))
    } catch {
      setScript('')
    }
  }, [address])

  if (!account || !addr || !address) {
    return <SSText>NOT FOUND</SSText>
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText>{t('address.details.title')}</SSText>
        }}
      />
      <SSMainLayout style={{ paddingBottom: 24, paddingTop: 12 }}>
        <ScrollView>
          <SSVStack>
            <SSVStack>
              <SSText weight="bold" uppercase size="md">
                {t('bitcoin.address')}
              </SSText>
              <SSAddressDisplay address={addr} />
            </SSVStack>
            <SSSeparator />
            <SSLabelDetails
              label={address.label}
              header={t('common.label').toUpperCase()}
              link={`/account/${accountId}/address/${addr}/label`}
            />
            <SSSeparator />
            <SSVStack gap="sm">
              <SSText uppercase weight="bold" size="md">
                {t('address.details.balance.title')}
              </SSText>
              <SSHStack>
                <SSVStack gap="xs" style={{ width: '45%', flexGrow: 1 }}>
                  <SSText color="muted" uppercase>
                    {t('address.details.balance.confirmed')}
                  </SSText>
                  <SSText>{formatNumber(address.summary.balance)}</SSText>
                </SSVStack>
                <SSVStack gap="xs" style={{ width: '45%', flexGrow: 1 }}>
                  <SSText color="muted" uppercase>
                    {t('address.details.balance.unconfirmed')}
                  </SSText>
                  <SSText>{formatNumber(address.summary.satsInMempool)}</SSText>
                </SSVStack>
              </SSHStack>
            </SSVStack>
            <SSSeparator />
            <SSVStack gap="sm">
              <SSText uppercase weight="bold" size="md">
                {t('address.details.history.title')}
              </SSText>
              <SSHStack>
                <SSVStack gap="xs" style={{ width: '45%', flexGrow: 1 }}>
                  <TouchableOpacity
                    onPress={() =>
                      router.navigate(
                        `/account/${accountId}/address/${addr}/transactions`
                      )
                    }
                  >
                    <SSText color="muted" uppercase>
                      {t('address.details.history.tx')}
                    </SSText>
                    <SSText>{address?.summary.transactions}</SSText>
                  </TouchableOpacity>
                </SSVStack>
                <SSVStack gap="xs" style={{ width: '45%', flexGrow: 1 }}>
                  <TouchableOpacity
                    onPress={() =>
                      router.navigate(
                        `/account/${accountId}/address/${addr}/utxos`
                      )
                    }
                  >
                    <SSText color="muted" uppercase>
                      {t('address.details.history.utxo')}
                    </SSText>
                    <SSText>{address?.summary.utxos}</SSText>
                  </TouchableOpacity>
                </SSVStack>
              </SSHStack>
            </SSVStack>
            <SSSeparator />
            <SSVStack gap="sm">
              <SSText uppercase weight="bold" size="md">
                {t('address.details.encoding.title')}
              </SSText>
              <SSHStack>
                <SSVStack gap="xs" style={{ width: '45%', flexGrow: 1 }}>
                  <SSText color="muted" uppercase>
                    {t('address.details.encoding.scriptVersion')}
                  </SSText>
                  <SSText uppercase>{address.scriptVersion || '-'}</SSText>
                </SSVStack>
                <SSVStack gap="xs" style={{ width: '45%', flexGrow: 1 }}>
                  <SSText color="muted" uppercase>
                    {t('address.details.encoding.network')}
                  </SSText>
                  <SSText uppercase>{address.network || '-'}</SSText>
                </SSVStack>
              </SSHStack>
              <SSVStack gap="xs">
                <SSText color="muted" uppercase>
                  {t('address.details.encoding.script')}
                </SSText>
                <SSText type="mono" uppercase>
                  {script}
                </SSText>
              </SSVStack>
            </SSVStack>
            <SSSeparator />
            <SSVStack gap="sm">
              <SSText uppercase weight="bold" size="md">
                {t('address.details.derivation.title')}
              </SSText>
              <SSHStack>
                <SSVStack gap="xs" style={{ width: '45%', flexGrow: 1 }}>
                  <SSText color="muted" uppercase>
                    {t('address.details.derivation.path')}
                  </SSText>
                  <SSText uppercase>{address.derivationPath || '-'}</SSText>
                </SSVStack>
                <SSVStack gap="xs" style={{ width: '45%', flexGrow: 1 }}>
                  <SSText color="muted" uppercase>
                    {t('address.details.derivation.index')}
                  </SSText>
                  <SSText uppercase>
                    {address.index !== undefined ? address.index : '-'}
                  </SSText>
                </SSVStack>
              </SSHStack>
              <SSHStack>
                <SSVStack gap="xs" style={{ width: '45%', flexGrow: 1 }}>
                  <SSText color="muted" uppercase>
                    {t('address.details.derivation.fingerprint')}
                  </SSText>
                  <SSText uppercase>{account.fingerprint || '-'}</SSText>
                </SSVStack>
                <SSVStack gap="xs" style={{ width: '45%', flexGrow: 1 }}>
                  <SSText color="muted" uppercase>
                    {t('address.details.derivation.keychain')}
                  </SSText>
                  <SSText uppercase>{address.keychain || '-'}</SSText>
                </SSVStack>
              </SSHStack>
            </SSVStack>
            <SSSeparator />
            <SSVStack>
              <SSText uppercase weight="bold" size="md">
                {t('address.details.key.title')}
              </SSText>
              <SSVStack gap="xs">
                <SSText uppercase color="muted">
                  {t('address.details.key.public')}
                </SSText>
                <SSText type="mono">-</SSText>
              </SSVStack>
              <SSVStack gap="xs">
                <SSText uppercase color="muted">
                  {t('address.details.key.private')}
                </SSText>
                <SSText type="mono">-</SSText>
              </SSVStack>
            </SSVStack>
          </SSVStack>
        </ScrollView>
      </SSMainLayout>
    </>
  )
}

export default AddressDetails
