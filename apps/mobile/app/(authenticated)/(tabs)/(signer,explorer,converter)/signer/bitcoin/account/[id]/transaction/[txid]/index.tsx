import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  InteractionManager,
  ScrollView,
  StyleSheet,
  View
} from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { getTransactionInputValues } from '@/api/bdk'
import { SSIconIncoming, SSIconOutgoing } from '@/components/icons'
import SSDetailsList from '@/components/SSDetailsList'
import SSLabelDetails from '@/components/SSLabelDetails'
import SSSeparator from '@/components/SSSeparator'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import SSTimeAgoText from '@/components/SSTimeAgoText'
import SSTransactionChart from '@/components/SSTransactionChart'
import SSTransactionDecoded from '@/components/SSTransactionDecoded'
import SSTransactionVinList from '@/components/SSTransactionVinList'
import SSTransactionVoutList from '@/components/SSTransactionVoutList'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { type Transaction } from '@/types/models/Transaction'
import { type TxSearchParams } from '@/types/navigation/searchParams'
import {
  formatConfirmations,
  formatFiatPrice,
  formatNumber
} from '@/utils/format'
import { bytesToHex } from '@/utils/scripts'

export default function TxDetails() {
  const { id: accountId, txid } = useLocalSearchParams<TxSearchParams>()

  const [account, tx, loadTx] = useAccountsStore(
    useShallow((state) => {
      const acc = state.accounts.find((a) => a.id === accountId)
      return [acc, acc?.transactions.find((t) => t.id === txid), state.loadTx]
    })
  )
  const ownAddresses = useMemo(
    () => new Set(account?.addresses?.map((a) => a.address) ?? []),
    [account]
  )

  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )

  const privacyMode = useSettingsStore((state) => state.privacyMode)

  const currentServer = configs[selectedNetwork].server

  const placeholder = '-'

  const [isReady, setIsReady] = useState(false)
  const [fee, setFee] = useState(placeholder)
  const [feePerByte, setFeePerByte] = useState(placeholder)
  const [feePerVByte, setFeePerVByte] = useState(placeholder)
  const [height, setHeight] = useState(placeholder)
  const [raw, setRaw] = useState('')
  const [size, setSize] = useState(placeholder)
  const [inputsCount, setInputsCount] = useState(placeholder)
  const [outputsCount, setOutputsCount] = useState(placeholder)
  const [version, setVersion] = useState(placeholder)
  const [vsize, setVsize] = useState(placeholder)
  const [weight, setWeight] = useState(placeholder)

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setIsReady(true)
    })
    return () => task.cancel()
  }, [])

  async function updateInfo() {
    if (!tx) return

    if (tx.blockHeight) setHeight(tx.blockHeight.toString())

    if (tx.size) setSize(tx.size.toString())

    if (tx.vsize) setVsize(tx.vsize.toString())

    if (tx.weight) setWeight(tx.weight.toString())

    if (tx.fee) setFee(tx.fee.toString())

    if (tx.fee && tx.size) setFeePerByte(formatNumber(tx.fee / tx.size))

    if (tx.fee && tx.vsize) setFeePerVByte(formatNumber(tx.fee / tx.vsize))

    if (tx.version) setVersion(tx.version.toString())

    if (tx.vin) setInputsCount(tx.vin.length.toString())

    if (tx.vout) setOutputsCount(tx.vout.length.toString())

    if (tx.raw) setRaw(bytesToHex(tx.raw))

    if (tx.vin.some((input) => input.value === undefined)) {
      const vin = await getTransactionInputValues(
        tx,
        currentServer.backend,
        currentServer.network,
        currentServer.url
      )
      loadTx(accountId!, { ...tx, vin })
    }
  }

  useEffect(() => {
    try {
      updateInfo()
    } catch {
      router.back()
    }
  }, [tx]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!accountId || !txid || !tx) return <Redirect href="/" />

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText>{t('transaction.details.title')}</SSText>
        }}
      />
      <SSVStack style={styles.container}>
        <SSTxDetailsHeader tx={tx} />
        <SSSeparator color="gradient" />
        <SSLabelDetails
          label={tx.label || ''}
          link={`/signer/bitcoin/account/${accountId}/transaction/${txid}/label`}
          header={t('transaction.label')}
          privacyMode={privacyMode}
        />
        {!isReady ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="white" size="large" />
          </View>
        ) : (
          <>
            <SSVStack style={{ paddingTop: 50 }}>
              <SSSeparator color="gradient" />
              <SSText uppercase color="muted">
                {t('transaction.details.chart')}
              </SSText>
              <SSTransactionChart
                transaction={tx}
                ownAddresses={ownAddresses}
                scale={0.9}
              />
            </SSVStack>
            <SSSeparator color="gradient" />
            <SSDetailsList
              columns={3}
              headerSize="sm"
              textSize="md"
              uppercase={false}
              items={[
                [t('transaction.block'), height, { width: '100%' }],
                [
                  t('transaction.hash'),
                  txid,
                  { width: '100%', copyToClipboard: true }
                ],
                [t('transaction.size'), size],
                [t('transaction.weight'), weight],
                [t('transaction.vsize'), vsize],
                [t('transaction.fee'), fee],
                [t('transaction.feeBytes'), feePerByte],
                [t('transaction.feeVBytes'), feePerVByte],
                [t('transaction.version'), version],
                [t('transaction.input.count'), inputsCount],
                [t('transaction.output.count'), outputsCount]
              ]}
            />
            <SSSeparator color="gradient" />
            <SSVStack gap="sm">
              <SSText
                uppercase
                color="muted"
                style={{ marginBottom: -30, marginTop: 50 }}
              >
                {t('transaction.decoded.title')}
              </SSText>
              {raw !== '' ? (
                <SSTransactionDecoded txHex={raw} />
              ) : (
                <SSText>{placeholder}</SSText>
              )}
            </SSVStack>

            <SSTransactionVinList vin={tx.vin} />
            <SSTransactionVoutList
              vout={tx.vout}
              txid={tx.id}
              accountId={accountId}
            />
          </>
        )}
      </SSVStack>
    </ScrollView>
  )
}

type SSTxDetailsHeaderProps = {
  tx: Transaction | undefined
}

export function SSTxDetailsHeader({ tx }: SSTxDetailsHeaderProps) {
  const [fiatCurrency, btcPrice] = usePriceStore((state) => [
    state.fiatCurrency,
    state.btcPrice
  ])

  const [lastKnownBlockHeight, getBlockchainHeight] = useBlockchainStore(
    useShallow((state) => [
      state.lastKnownBlockHeight,
      state.getBlockchainHeight
    ])
  )

  const [currencyUnit, useZeroPadding] = useSettingsStore(
    useShallow((state) => [state.currencyUnit, state.useZeroPadding])
  )

  const [amount, setAmount] = useState(0)
  const [oldPrice, setOldPrice] = useState('')
  const [price, setPrice] = useState('')
  const [type, setType] = useState('')
  const [inputsCount, setInputsCount] = useState(0)

  const confirmations =
    tx?.blockHeight && lastKnownBlockHeight > 0
      ? lastKnownBlockHeight - tx.blockHeight + 1
      : 0

  const updateInfo = async () => {
    if (!tx) return

    const amount = tx.received - tx.sent
    setAmount(amount)
    setType(tx.type)

    if (btcPrice) setPrice(formatFiatPrice(Number(amount), btcPrice))

    if (tx.prices) {
      setOldPrice(formatFiatPrice(Number(amount), tx.prices[fiatCurrency] || 0))
    }

    if (tx.vin) setInputsCount(tx.vin.length)

    if (tx.blockHeight && lastKnownBlockHeight === 0) {
      getBlockchainHeight()
    }
  }

  useEffect(() => {
    updateInfo()
  }, [tx, lastKnownBlockHeight]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SSVStack gap="none" style={{ alignItems: 'center' }}>
      {tx?.timestamp && <SSTimeAgoText date={new Date(tx.timestamp)} />}
      <SSVStack gap="xs" style={{ alignItems: 'center', marginTop: 16 }}>
        <SSHStack gap="sm" style={{ alignItems: 'center' }}>
          {type === 'receive' && <SSIconIncoming height={12} width={12} />}
          {type === 'send' && <SSIconOutgoing height={12} width={12} />}
          <SSHStack gap="xs" style={{ alignItems: 'baseline', width: 'auto' }}>
            {amount !== 0 ? (
              <SSStyledSatText
                amount={Math.abs(amount)}
                decimals={0}
                useZeroPadding={useZeroPadding}
                currency={currencyUnit}
                type={tx?.type}
                weight="light"
              />
            ) : (
              <SSText color="muted">?</SSText>
            )}
            <SSText color="muted">
              {currencyUnit === 'btc' ? t('bitcoin.btc') : t('bitcoin.sats')}
            </SSText>
          </SSHStack>
        </SSHStack>
        {(price || oldPrice) && (
          <SSHStack gap="xs">
            {price && (
              <SSText color="muted" size="sm">
                {price}
              </SSText>
            )}
            {oldPrice && (
              <SSText color="muted" size="sm">
                ({oldPrice})
              </SSText>
            )}
            <SSText color="muted" size="sm">
              {fiatCurrency}
            </SSText>
          </SSHStack>
        )}
      </SSVStack>
      <SSHStack gap="sm">
        <SSText
          style={{
            color:
              confirmations < 1
                ? Colors.error
                : confirmations < 6
                  ? Colors.warning
                  : Colors.success
          }}
        >
          {formatConfirmations(confirmations)}
        </SSText>
        <SSHStack gap="xs">
          <SSText color="muted">{t('common.from').toLowerCase()}</SSText>
          <SSText>
            {inputsCount || '?'}{' '}
            {inputsCount === 1
              ? t('transaction.input.singular').toLowerCase()
              : t('transaction.input.plural').toLowerCase()}
          </SSText>
        </SSHStack>
      </SSHStack>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: 20
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center'
  }
})
