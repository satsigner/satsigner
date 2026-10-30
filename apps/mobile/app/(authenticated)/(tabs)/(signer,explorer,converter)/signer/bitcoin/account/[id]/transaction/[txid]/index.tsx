import { hex } from '@scure/base'
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { getTransactionInputValues } from '@/api/bdk'
import { SSIconIncoming, SSIconOutgoing } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSDetailsList from '@/components/SSDetailsList'
import SSFeeReplacementFlags from '@/components/SSFeeReplacementFlags'
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
import { useChartSettingStore } from '@/store/chartSettings'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors, Sizes } from '@/styles'
import { type FeeReplacementKind } from '@/types/models/FeeReplacement'
import { type Transaction } from '@/types/models/Transaction'
import { type TxSearchParams } from '@/types/navigation/searchParams'
import { getAccountAddressSets } from '@/utils/address'
import { getConfirmationsColorStyle } from '@/utils/confirmations'
import { getFeeReplacementOptions } from '@/utils/feeReplacement'
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
import {
  analyzePossiblePayjoin,
  buildOwnedOutpoints
} from '@/utils/sankeyInputOwnership'
import { getUtxoOutpoint } from '@/utils/utxo'
import {
  annotateTransactionsWithWalletOwnership,
  getWalletTransactionEffect
} from '@/utils/walletOwnership'

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
      annotateTransactionsWithWalletOwnership(
        account.transactions,
        account.addresses,
        account.utxos
      ).find((annotated) => annotated.id === tx.id) ?? tx
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
  const ownedOutpoints = useMemo(
    () =>
      buildOwnedOutpoints({
        addresses: account?.addresses,
        transactions: account?.transactions,
        utxos: account?.utxos
      }),
    [account?.addresses, account?.transactions, account?.utxos]
  )
  const payjoinInsight = useMemo(
    () => analyzePossiblePayjoin(displayTx?.vin, ownedOutpoints),
    [displayTx?.vin, ownedOutpoints]
  )

  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )

  const privacyMode = useSettingsStore((state) => state.privacyMode)

  const showTransactionFlowChart = useChartSettingStore(
    (state) => state.showTransactionFlowChart
  )

  const currentServer = configs[selectedNetwork].server

  const feeReplacement =
    account && displayTx
      ? getFeeReplacementOptions({
          account,
          backend: currentServer.backend,
          ownedOutpoints,
          tx: displayTx
        })
      : undefined

  const placeholder = '-'

  const [isReady, setIsReady] = useState(false)
  const [chartLoading, setChartLoading] = useState(true)
  const [chartTxid, setChartTxid] = useState(txid)
  if (txid !== chartTxid) {
    setChartTxid(txid)
    setChartLoading(true)
  }

  const height = tx?.blockHeight
    ? tx.blockHeight.toLocaleString('en-US')
    : placeholder
  const size = tx?.size ? tx.size.toString() : placeholder
  const vsize = tx?.vsize ? tx.vsize.toString() : placeholder
  const weight = tx?.weight ? tx.weight.toString() : placeholder
  const fee = tx?.fee ? tx.fee.toString() : placeholder
  const feePerByte =
    tx?.fee && tx.size ? formatNumber(tx.fee / tx.size) : placeholder
  const feePerVByte =
    tx?.fee && tx.vsize ? formatNumber(tx.fee / tx.vsize) : placeholder
  const version = tx?.version ? tx.version.toString() : placeholder
  const inputsCount = tx?.vin ? tx.vin.length.toString() : placeholder
  const outputsCount = tx?.vout ? tx.vout.length.toString() : placeholder
  const raw = tx?.raw ? hex.encode(Uint8Array.from(tx.raw)) : ''

  useEffect(() => {
    // requestIdleCallback replaces deprecated InteractionManager.runAfterInteractions.
    // Frame-tick driven: pauses while backgrounded; does not wait for UI-thread animations.
    const idleHandle = requestIdleCallback(() => {
      setIsReady(true)
    })
    return () => cancelIdleCallback(idleHandle)
  }, [])

  async function loadMissingInputValues() {
    if (!tx) {
      return
    }

    if (tx.vin.some((input) => input.value === undefined)) {
      const vin = await getTransactionInputValues(
        tx,
        currentServer.backend,
        currentServer.network,
        currentServer.url,
        currentServer.rpcCredentials
      )
      loadTx(accountId, { ...tx, vin })
    }
  }

  useEffect(() => {
    try {
      loadMissingInputValues()
    } catch {
      router.back()
    }
  }, [tx]) // eslint-disable-line react-hooks/exhaustive-deps

  function openFeeReplacement(kind: FeeReplacementKind) {
    router.navigate(
      `/signer/bitcoin/account/${accountId}/transaction/${txid}/feeReplacement?kind=${kind}`
    )
  }

  function handleIncreaseFee() {
    openFeeReplacement('bump')
  }

  function handleCancelToSelf() {
    openFeeReplacement('cancel')
  }

  function handleChildPaysForParent() {
    openFeeReplacement('cpfp')
  }

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
        <SSTxDetailsHeader
          tx={displayTx}
          contributedSats={
            payjoinInsight.possiblePayjoin && displayTx?.type === 'receive'
              ? payjoinInsight.contributedSats
              : undefined
          }
        />
        {feeReplacement?.assessment.unconfirmed ? (
          <SSVStack gap="xs">
            <SSFeeReplacementFlags
              rbf={feeReplacement.assessment.signalsRbf}
              cpfp={feeReplacement.assessment.canCpfp}
            />
            {feeReplacement.actions.bump ? (
              <SSButton
                variant="outline"
                label={t('transaction.feeReplacement.bump')}
                onPress={handleIncreaseFee}
              />
            ) : null}
            {feeReplacement.actions.cancel ? (
              <SSButton
                variant="danger"
                label={t('transaction.feeReplacement.cancel.action')}
                onPress={handleCancelToSelf}
              />
            ) : null}
            {feeReplacement.actions.cpfp ? (
              <SSButton
                variant="outline"
                label={t('transaction.feeReplacement.cpfp')}
                onPress={handleChildPaysForParent}
              />
            ) : null}
          </SSVStack>
        ) : null}
        <SSSeparator color="gradient" />
        <SSLabelDetails
          label={displayTx.label || ''}
          onPress={() =>
            router.navigate(
              `/signer/bitcoin/account/${accountId}/transaction/${txid}/label`
            )
          }
          header={t('transaction.label')}
          privacyMode={privacyMode}
        />
        {showTransactionFlowChart && (
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
            {payjoinInsight.possiblePayjoin ? (
              <SSText
                testID="tx-details-possible-payjoin"
                color="muted"
                size="sm"
              >
                {t('transaction.details.possiblePayjoin')}
              </SSText>
            ) : null}
            <SSTransactionChart
              key={txid}
              transaction={displayTx}
              ownAddresses={ownAddresses}
              internalAddresses={internalAddresses}
              unspentOutpoints={unspentOutpoints}
              ownedOutpoints={ownedOutpoints}
              txLabelsById={txLabelsById}
              knownTxIds={knownTxIds}
              spendingTxIdsByOutpoint={spendingTxIdsByOutpoint}
              outpointLabelsByRef={outpointLabelsByRef}
              scale={0.9}
              onLoadingChange={setChartLoading}
              onOpenLinkedTx={(linkedTxId) =>
                router.push(
                  `/signer/bitcoin/account/${accountId}/transaction/${linkedTxId}`
                )
              }
            />
          </SSVStack>
        )}
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
              onOpenUtxo={(index) =>
                router.navigate(
                  `/signer/bitcoin/account/${accountId}/transaction/${displayTx.id}/utxo/${index}`
                )
              }
              onOpenAddress={(address) =>
                router.navigate(
                  `/signer/bitcoin/account/${accountId}/address/${address}`
                )
              }
            />
          </>
        )}
      </SSVStack>
    </ScrollView>
  )
}

type SSTxDetailsHeaderProps = {
  tx: Transaction | undefined
  /** Own input sats when this receive looks like a Payjoin contribution. */
  contributedSats?: number
}

export function SSTxDetailsHeader({
  tx,
  contributedSats
}: SSTxDetailsHeaderProps) {
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

  const { amount, type } = tx
    ? getWalletTransactionEffect(tx)
    : { amount: 0, type: 'receive' as const }
  const inputsCount = tx?.vin?.length ?? 0
  const outputsCount = tx?.vout?.length ?? 0

  const confirmations =
    tx?.blockHeight && lastKnownBlockHeight > 0
      ? lastKnownBlockHeight - tx.blockHeight + 1
      : 0
  const confirmationColorStyle = getConfirmationsColorStyle(confirmations)

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

  const contributedLabel =
    contributedSats && contributedSats > 0
      ? t('transaction.details.contributed', {
          amount: privacyMode ? '••••' : formatNumber(contributedSats)
        })
      : undefined

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
                    type={type}
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
        {contributedLabel ? (
          <SSText testID="tx-details-contributed" color="muted" size="sm">
            {contributedLabel}
          </SSText>
        ) : null}
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
      <SSHStack gap="sm" style={styles.metaRow}>
        <SSText
          weight="light"
          style={[styles.metaText, confirmationColorStyle]}
        >
          {formatConfirmations(confirmations)}
        </SSText>
        <SSText style={styles.metaText}>
          <SSText color="muted">{t('common.from').toLowerCase()} </SSText>
          {inputsCount || '?'}{' '}
          {inputsCount === 1
            ? t('transaction.input.singular').toLowerCase()
            : t('transaction.input.plural').toLowerCase()}
        </SSText>
        <SSText style={styles.metaText}>
          <SSText color="muted">{t('common.to').toLowerCase()} </SSText>
          {outputsCount || '?'}{' '}
          {outputsCount === 1
            ? t('transaction.output.singular').toLowerCase()
            : t('transaction.output.plural').toLowerCase()}
        </SSText>
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
  },
  metaRow: {
    alignItems: 'baseline'
  },
  metaText: {
    includeFontPadding: false
  }
})
