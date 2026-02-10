import { toOutputScript } from 'bitcoinjs-lib/src/address'
import { toASM } from 'bitcoinjs-lib/src/script'
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, useWindowDimensions } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useShallow } from 'zustand/react/shallow'

import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSBubbleChart from '@/components/SSBubbleChart'
import SSDetailsList from '@/components/SSDetailsList'
import SSLabelDetails from '@/components/SSLabelDetails'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSTransactionCard from '@/components/SSTransactionCard'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { Colors } from '@/styles'
import { type Account } from '@/types/models/Account'
import { type Utxo } from '@/types/models/Utxo'
import { type AddrSearchParams } from '@/types/navigation/searchParams'
import { extractAccountFingerprint } from '@/utils/account'
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

  const addressUtxos = useAccountsStore((state) =>
    state.accounts
      .find((account: Account) => account.id === accountId)
      ?.utxos.filter((utxo) => address?.utxos.includes(getUtxoOutpoint(utxo)))
  )

  const allAccountUtxos = useAccountsStore(
    (state) =>
      state.accounts.find((account: Account) => account.id === accountId)
        ?.utxos || []
  )

  const addressUtxoInputs = useMemo(() => {
    return addressUtxos || []
  }, [addressUtxos])

  const getBlockchainHeight = useBlockchainStore(
    (state) => state.getBlockchainHeight
  )

  const [btcPrice, fiatCurrency] = usePriceStore(
    useShallow((state) => [state.btcPrice, state.fiatCurrency])
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
              link={`/signer/bitcoin/account/${accountId}/address/${addr}/label`}
            />
            <SSSeparator />
            <SSVStack gap="sm">
              <SSDetailsList
                columns={2}
                items={[
                  [
                    t('address.details.balance.confirmed'),
                    formatNumber(address.summary.balance)
                  ],
                  [
                    t('bitcoin.confirmations.unconfirmed'),
                    formatNumber(address.summary.satsInMempool)
                  ],
                  [
                    t('address.details.history.tx'),
                    address?.summary.transactions
                  ],
                  [t('address.details.history.utxo'), address?.summary.utxos]
                ]}
              />
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
                        fiatCurrency={fiatCurrency}
                        btcPrice={btcPrice}
                        link={`/signer/bitcoin/account/${accountId}/transaction/${tx.id}`}
                        expand
                      />
                    ))}
                  </SSVStack>
                </SSVStack>
                <SSSeparator />
              </>
            )}
            {addressUtxos &&
              addressUtxos.length > 0 &&
              allAccountUtxos.length > 0 && (
                <>
                  <SSVStack>
                    <SSText uppercase weight="bold" size="md">
                      {t('bitcoin.utxos')}
                    </SSText>
                    <GestureHandlerRootView style={{ flex: 1 }}>
                      <SSBubbleChart
                        utxos={allAccountUtxos}
                        canvasSize={{
                          width: GRAPH_WIDTH,
                          height: GRAPH_HEIGHT
                        }}
                        inputs={addressUtxoInputs}
                        dimUnselected
                        onPress={({ txid, vout }: Utxo) =>
                          router.navigate(
                            `/signer/bitcoin/account/${accountId}/transaction/${txid}/utxo/${vout}`
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
              <SSDetailsList
                columns={2}
                items={[
                  [
                    t('address.details.encoding.scriptVersion'),
                    address.scriptVersion
                  ],
                  [t('address.details.encoding.network'), address.network]
                ]}
              />
              <SSVStack gap="xs">
                <SSText uppercase weight="bold">
                  {t('address.details.encoding.script')}
                </SSText>
                <SSText type="mono" uppercase color="muted">
                  {script}
                </SSText>
              </SSVStack>
            </SSVStack>
            <SSSeparator />
            <SSVStack gap="sm">
              <SSText uppercase weight="bold" size="md">
                {t('address.details.derivation.title')}
              </SSText>
              <SSDetailsList
                columns={2}
                items={[
                  [
                    t('address.details.derivation.path'),
                    address.derivationPath
                  ],
                  [t('address.details.derivation.index'), address.index],
                  [
                    t('address.details.derivation.fingerprint'),
                    extractAccountFingerprint(account)
                  ],
                  [t('address.details.derivation.keychain'), address.keychain]
                ]}
              />
            </SSVStack>
            <SSSeparator />
            <SSVStack>
              <SSText uppercase weight="bold" size="md">
                {t('address.details.key.title')}
              </SSText>
              <SSDetailsList
                columns={1}
                items={[
                  [t('address.details.key.public'), ''],
                  [t('address.details.key.private'), '']
                ]}
              />
            </SSVStack>
          </SSVStack>
        </SSMainLayout>
      </ScrollView>
    </>
  )
}

export default AddressDetails
