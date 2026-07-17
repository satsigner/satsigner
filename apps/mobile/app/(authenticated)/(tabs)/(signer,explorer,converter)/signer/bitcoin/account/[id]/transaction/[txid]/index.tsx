import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  InteractionManager,
  ScrollView,
  StyleSheet
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
import { useFiatData } from '@/hooks/useFiatData'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors, Sizes } from '@/styles'
import { type Transaction } from '@/types/models/Transaction'
import { type TxSearchParams } from '@/types/navigation/searchParams'
import { getAccountAddressSets } from '@/utils/address'
import {
  formatConfirmations,
  formatFiatPrice,
  formatNumber,
  formatPercentualChange
} from '@/utils/format'
import {
  buildKnownTxIds,
  buildOutpointLabelsByRef,
  buildSpendingTxIdsByOutpoint,
  buildTxLabelsById
} from '@/utils/sankeyInputLabel'
import { bytesToHex } from '@/utils/scripts'
import { getUtxoOutpoint } from '@/utils/utxo'
import { annotateTransactionsWithWalletOwnership } from '@/utils/walletOwnership'

export default function TxDetails() {
  const { id: accountId, txid } = useLocalSearchParams<TxSearchParams>()

  const [account, tx, loadTx] = useAccountsStore(
    useShallow((state) => {
      const acc = state.accounts.find((a) => a.id === accountId)
      return [acc, acc?.transactions.find((t) => t.id === txid), state.loadTx]
    })
  )
  const { ownAddresses, internalAddresses } = useMemo(
    () => getAccountAddressSets(account?.addresses ?? []),
    [account?.addresses]
  )
  const displayTx = useMemo(() => {
    if (!tx || !account) {
      return tx
    }
    return (
      annotateTransactionsWithWalletOwnership([tx], account.addresses)[0] ?? tx
    )
  }, [account, tx])
  const unspentOutpoints = useMemo(
    () => new Set(account?.utxos.map(getUtxoOutpoint)),
    [account?.utxos]
  )
  const txLabelsById = useMemo(
    () => buildTxLabelsById(account?.transactions),
    [account?.transactions]
  )
  const knownTxIds = useMemo(
    () => buildKnownTxIds(account?.transactions),
    [account?.transactions]
  )
  const spendingTxIdsByOutpoint = useMemo(
    () => buildSpendingTxIdsByOutpoint(account?.transactions),
    [account?.transactions]
  )
  const outpointLabelsByRef = useMemo(
    () => buildOutpointLabelsByRef(account ?? {}),
    [account]
  )

  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )

  const privacyMode = useSettingsStore((state) => state.privacyMode)

  const currentServer = configs[selectedNetwork].server

  const placeholder = '-'

  const [isReady, setIsReady] = useState(false)
  const [chartLoading, setChartLoading] = useState(true)
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

  useEffect(() => {
    setChartLoading(true)
  }, [txid])

  async function updateInfo() {
    if (!tx) {
      return
    }

    if (tx.blockHeight) {
      setHeight(tx.blockHeight.toLocaleString('en-US'))
    }

    if (tx.size) {
      setSize(tx.size.toString())
    }

    if (tx.vsize) {
      setVsize(tx.vsize.toString())
    }

    if (tx.weight) {
      setWeight(tx.weight.toString())
    }

    if (tx.fee) {
      setFee(tx.fee.toString())
    }

    if (tx.fee && tx.size) {
      setFeePerByte(formatNumber(tx.fee / tx.size))
    }

    if (tx.fee && tx.vsize) {
      setFeePerVByte(formatNumber(tx.fee / tx.vsize))
    }

    if (tx.version) {
      setVersion(tx.version.toString())
    }

    if (tx.vin) {
      setInputsCount(tx.vin.length.toString())
    }

    if (tx.vout) {
      setOutputsCount(tx.vout.length.toString())
    }

    if (tx.raw) {
      setRaw(bytesToHex(tx.raw))
    }

    if (tx.vin.some((input) => input.value === undefined)) {
      const vin = await getTransactionInputValues(
        tx,
        currentServer.backend,
        currentServer.network,
        currentServer.url,
        currentServer.rpcCredentials
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

  if (!accountId || !txid || !displayTx) {
    return <Redirect href="/" />
  }

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText>{t('transaction.details.title')}</SSText>
        }}
      />
      <SSVStack style={styles.container}>
        <SSTxDetailsHeader tx={displayTx} />
        <SSSeparator color="gradient" />
        <SSLabelDetails
          label={displayTx.label || ''}
          link={`/signer/bitcoin/account/${accountId}/transaction/${txid}/label`}
          header={t('transaction.label')}
          privacyMode={privacyMode}
        />
        <SSVStack style={{ paddingTop: 50 }}>
          <SSSeparator color="gradient" />
          <SSHStack gap="xxs">
            <SSText uppercase color="muted">
              {t('transaction.details.chart')}
            </SSText>
            {chartLoading ? (
              <ActivityIndicator
                size="small"
                color={Colors.gray[300]}
                style={{ transform: [{ scale: 0.7 }] }}
              />
            ) : null}
          </SSHStack>
          <SSTransactionChart
            key={txid}
            accountId={accountId}
            transaction={displayTx}
            ownAddresses={ownAddresses}
            internalAddresses={internalAddresses}
            unspentOutpoints={unspentOutpoints}
            txLabelsById={txLabelsById}
            knownTxIds={knownTxIds}
            spendingTxIdsByOutpoint={spendingTxIdsByOutpoint}
            outpointLabelsByRef={outpointLabelsByRef}
            scale={0.9}
            onLoadingChange={setChartLoading}
          />
        </SSVStack>
        {!isReady ? null : (
          <>
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
                  { copyToClipboard: true, variant: 'mono', width: '100%' }
                ],
                [t('transaction.size'), size, { unit: t('bitcoin.bytes') }],
                [t('transaction.weight'), weight],
                [t('transaction.vsize'), vsize],
                [t('transaction.fee'), fee, { unit: t('bitcoin.sats') }],
                [t('transaction.feeBytes'), feePerByte],
                [t('transaction.feeVBytes'), feePerVByte],
                [t('transaction.version'), version],
                [t('transaction.input.count'), inputsCount],
                [t('transaction.output.count'), outputsCount]
              ]}
            />
            <SSSeparator color="gradient" />
            <SSVStack gap="sm">
              <SSText uppercase color="muted">
                {t('transaction.decoded.title')}
              </SSText>
              {raw !== '' ? (
                <SSTransactionDecoded txHex={raw} />
              ) : (
                <SSText>{placeholder}</SSText>
              )}
            </SSVStack>
            <SSTransactionVinList vin={displayTx.vin} />
            <SSTransactionVoutList
              vout={displayTx.vout}
              txid={displayTx.id}
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
  const [fiatCurrency, btcPrice] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.btcPrice])
  )
  const { showCurrentFiat, showHistoricalFiat } = useFiatData()
  const effectiveBtcPrice = showCurrentFiat ? btcPrice : 0

  const lastKnownBlockHeight = useBlockchainStore(
    (state) => state.lastKnownBlockHeight
  )

  const [currencyUnit, useZeroPadding, privacyMode] = useSettingsStore(
    useShallow((state) => [
      state.currencyUnit,
      state.useZeroPadding,
      state.privacyMode
    ])
  )

  const amount = tx
    ? tx.type === 'receive'
      ? tx.received
      : tx.sent - tx.received
    : 0
  const type = tx?.type ?? ''
  const inputsCount = tx?.vin?.length ?? 0
  const outputsCount = tx?.vout?.length ?? 0

  const confirmations =
    tx?.blockHeight && lastKnownBlockHeight > 0
      ? lastKnownBlockHeight - tx.blockHeight + 1
      : 0

  const historicalBtcPrice = showHistoricalFiat
    ? tx?.prices?.[fiatCurrency]
    : undefined
  const price =
    showCurrentFiat && effectiveBtcPrice > 0
      ? formatFiatPrice(Math.abs(amount), effectiveBtcPrice)
      : ''
  const oldPrice =
    showHistoricalFiat && historicalBtcPrice && historicalBtcPrice > 0
      ? formatFiatPrice(Math.abs(amount), historicalBtcPrice)
      : ''
  const percentChange =
    showCurrentFiat &&
    showHistoricalFiat &&
    effectiveBtcPrice > 0 &&
    historicalBtcPrice &&
    historicalBtcPrice > 0
      ? formatPercentualChange(effectiveBtcPrice, historicalBtcPrice)
      : ''

  return (
    <SSVStack gap="sm" itemsCenter>
      {tx?.timestamp ? <SSTimeAgoText date={new Date(tx.timestamp)} /> : null}
      <SSVStack gap="xxs" itemsCenter>
        <SSHStack gap="sm" style={{ alignItems: 'center' }}>
          {type === 'receive' && <SSIconIncoming height={12} width={12} />}
          {type === 'send' && <SSIconOutgoing height={12} width={12} />}
          <SSHStack gap="xs" style={{ alignItems: 'baseline', width: 'auto' }}>
            {amount !== 0 ? (
              <SSText
                size="4xl"
                weight="ultralight"
                style={{ lineHeight: Sizes.text.fontSize['4xl'] }}
              >
                {privacyMode ? (
                  '••••'
                ) : (
                  <SSStyledSatText
                    amount={Math.abs(amount)}
                    decimals={0}
                    useZeroPadding={useZeroPadding}
                    currency={currencyUnit}
                    type={tx?.type}
                    textSize="4xl"
                    noColor={false}
                    showSign={false}
                    weight="ultralight"
                    letterSpacing={0.1}
                  />
                )}
              </SSText>
            ) : (
              <SSText color="muted">?</SSText>
            )}
            <SSText color="muted" size="xl">
              {currencyUnit === 'btc' ? t('bitcoin.btc') : t('bitcoin.sats')}
            </SSText>
          </SSHStack>
        </SSHStack>
        {price || oldPrice ? (
          <SSHStack gap="xs">
            {price ? (
              <SSText color="muted" size="sm">
                {privacyMode ? '••••' : price}
              </SSText>
            ) : null}
            <SSText size="sm" style={{ color: Colors.gray[500] }}>
              {fiatCurrency}
            </SSText>
            {oldPrice ? (
              <SSText color="muted" size="sm">
                ({privacyMode ? '••••' : oldPrice})
              </SSText>
            ) : null}
            {!privacyMode && percentChange !== '' ? (
              <SSText
                size="sm"
                style={{
                  color:
                    percentChange[0] === '+'
                      ? Colors.softBarGreen
                      : Colors.softBarRed
                }}
              >
                {percentChange}
              </SSText>
            ) : null}
          </SSHStack>
        ) : null}
      </SSVStack>
      <SSHStack gap="sm">
        <SSText
          weight="light"
          style={{
            color:
              confirmations < 1
                ? Colors.error
                : confirmations < 6
                  ? Colors.warning
                  : Colors.mainGreen
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
        <SSHStack gap="xs">
          <SSText color="muted">{t('common.to').toLowerCase()}</SSText>
          <SSText>
            {outputsCount || '?'}{' '}
            {outputsCount === 1
              ? t('transaction.output.singular').toLowerCase()
              : t('transaction.output.plural').toLowerCase()}
          </SSText>
        </SSHStack>
      </SSHStack>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    flexGrow: 1,
    justifyContent: 'space-between',
    padding: 20
  }
})
