import { toOutputScript } from 'bitcoinjs-lib/src/address'
import { toASM } from 'bitcoinjs-lib/src/script'
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, useWindowDimensions } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSBubbleChart from '@/components/SSBubbleChart'
import SSLabelDetails from '@/components/SSLabelDetails'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSTransactionCard from '@/components/SSTransactionCard'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import { type Account } from '@/types/models/Account'
import { type Utxo } from '@/types/models/Utxo'
import { type AddrSearchParams } from '@/types/navigation/searchParams'
import { bitcoinjsNetwork } from '@/utils/bitcoin'
import { formatNumber } from '@/utils/format'
import { getUtxoOutpoint } from '@/utils/utxo'

function AddressDetails() {
  const { id: accountId, addr } = useLocalSearchParams<AddrSearchParams>()
  const [script, setScript] = useState('')

  const [account, address] = useAccountsStore((state) => [
    state.accounts.find((account) => account.id === accountId),
    state.accounts
      .find((account) => account.id === accountId)
      ?.addresses.find((address) => {
        return address.address === addr
      })
  ])

  const transactions = useAccountsStore((state) =>
    state.accounts
      .find((account: Account) => account.id === accountId)
      ?.transactions.filter((tx) => address?.transactions.includes(tx.id))
  )

  const utxos = useAccountsStore((state) =>
    state.accounts
      .find((account: Account) => account.id === accountId)
      ?.utxos.filter((utxo) => address?.utxos.includes(getUtxoOutpoint(utxo)))
  )

  const getBlockchainHeight = useBlockchainStore(
    (state) => state.getBlockchainHeight
  )

  const [blockchainHeight, setBlockchainHeight] = useState<number>(0)

  const { width, height } = useWindowDimensions()

  const mainLayoutHorizontalPadding = 12
  const GRAPH_HEIGHT = height * 0.44
  const GRAPH_WIDTH = width * ((100 - mainLayoutHorizontalPadding) / 100)

  async function refreshBlockchainHeight() {
    const height = await getBlockchainHeight()
    setBlockchainHeight(height)
  }

  useEffect(() => {
    refreshBlockchainHeight()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    return <Redirect href="/" />
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText>{t('address.details.title')}</SSText>
        }}
      />
      <ScrollView>
        <SSMainLayout style={{ paddingBottom: 24, paddingTop: 12 }}>
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
                  <SSText color="muted" uppercase>
                    {t('address.details.history.tx')}
                  </SSText>
                  <SSText>{address?.summary.transactions}</SSText>
                </SSVStack>
                <SSVStack gap="xs" style={{ width: '45%', flexGrow: 1 }}>
                  <SSText color="muted" uppercase>
                    {t('address.details.history.utxo')}
                  </SSText>
                  <SSText>{address?.summary.utxos}</SSText>
                </SSVStack>
              </SSHStack>
            </SSVStack>
            <SSSeparator />
            {transactions && transactions.length > 0 && (
              <>
                <SSVStack>
                  <SSText uppercase size="md" weight="bold">
                    {t('bitcoin.transactions')}
                  </SSText>
                  <SSVStack gap="none">
                    {transactions.map((tx, index) => (
                      <SSTransactionCard
                        style={{
                          paddingHorizontal: 0,
                          paddingBottom: 8,
                          borderTopWidth: index > 0 ? 1 : 0,
                          borderColor: Colors.gray[700]
                        }}
                        transaction={tx}
                        key={tx.id}
                        blockHeight={blockchainHeight}
                        fiatCurrency="USD"
                        btcPrice={0}
                        link={`/account/${accountId}/transaction/${tx.id}`}
                        expand
                      />
                    ))}
                  </SSVStack>
                </SSVStack>
                <SSSeparator />
              </>
            )}
            {utxos && utxos.length > 0 && (
              <>
                <SSVStack>
                  <SSText uppercase size="md" weight="bold">
                    {t('bitcoin.utxos')}
                  </SSText>
                  <GestureHandlerRootView style={{ flex: 1 }}>
                    <SSBubbleChart
                      utxos={utxos}
                      canvasSize={{ width: GRAPH_WIDTH, height: GRAPH_HEIGHT }}
                      inputs={[]}
                      onPress={({ txid, vout }: Utxo) =>
                        router.navigate(
                          `/account/${accountId}/transaction/${txid}/utxo/${vout}`
                        )
                      }
                    />
                  </GestureHandlerRootView>
                </SSVStack>
                <SSSeparator />
              </>
            )}
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
                  <SSText uppercase>
                    {account.keys[0].fingerprint || '-'}
                  </SSText>
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
        </SSMainLayout>
      </ScrollView>
    </>
  )
}

export default AddressDetails
