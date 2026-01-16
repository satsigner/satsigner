import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSBubbleChart from '@/components/SSBubbleChart'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSLabelDetails from '@/components/SSLabelDetails'
import SSScriptDecoded from '@/components/SSScriptDecoded'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSTransactionChart from '@/components/SSTransactionChart'
import useGetAccountTransactionOutput from '@/hooks/useGetAccountTransactionOutput'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type UtxoSearchParams } from '@/types/navigation/searchParams'
import { formatDate, formatNumber } from '@/utils/format'

type UtxoDetailsProps = {
  accountId: string
  onPressAddress: () => void
  onPressTx: () => void
  tx?: Transaction
  utxo?: Utxo
}

function UtxoDetails({
  accountId,
  onPressAddress,
  onPressTx,
  tx,
  utxo,
  allAccountUtxos
}: UtxoDetailsProps & { allAccountUtxos: Utxo[] }) {
  const placeholder = '-'
  const [blockTime, setBlockTime] = useState(placeholder)
  const [blockHeight, setBlockHeight] = useState(placeholder)
  const [amount, setAmount] = useState(placeholder)
  const [txid, setTxid] = useState(placeholder)
  const [vout, setVout] = useState(placeholder)

  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
  )
  const [currencyUnit, useZeroPadding] = useSettingsStore(
    useShallow((state) => [state.currencyUnit, state.useZeroPadding])
  )

  const { width, height } = useWindowDimensions()
  const outerContainerPadding = 20
  const GRAPH_HEIGHT = height * 0.44
  const GRAPH_WIDTH = width - outerContainerPadding * 2

  const currentUtxoInputs = useMemo(() => {
    if (!utxo) return []
    return [utxo]
  }, [utxo])

  const updateInfo = () => {
    if (tx) {
      const { blockHeight, timestamp } = tx
      setTxid(tx.id)
      if (blockHeight) setBlockHeight(blockHeight.toString())
      if (timestamp) setBlockTime(formatDate(timestamp))
    }

    if (utxo) {
      const { value } = utxo
      setVout(utxo.vout.toString())
      if (value) setAmount(formatNumber(value))
    }
  }

  useEffect(() => {
    try {
      updateInfo()
    } catch {
      //
    }
  }, [tx, utxo]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScrollView>
      <SSVStack gap="lg" style={styles.innerContainer}>
        <SSVStack>
          <SSLabelDetails
            label={utxo?.label || ''}
            link={`/signer/bitcoin/account/${accountId}/transaction/${txid}/utxo/${vout}/label`}
            header={t('utxo.label')}
          />
        </SSVStack>
        <SSSeparator color="gradient" />
        {utxo && (
          <>
            <SSVStack gap="sm">
              <SSText weight="bold" uppercase>
                {t('common.amount')}
              </SSText>
              <SSClipboardCopy text={utxo.value.toString()}>
                <SSVStack gap="xs">
                  <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                    <SSStyledSatText
                      amount={utxo.value}
                      decimals={0}
                      useZeroPadding={useZeroPadding}
                      currency={currencyUnit}
                      textSize="4xl"
                      weight="light"
                    />
                    <SSText color="muted">
                      {currencyUnit === 'btc'
                        ? t('bitcoin.btc')
                        : t('bitcoin.sats')}
                    </SSText>
                  </SSHStack>
                  <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                    <SSText color="muted">
                      {formatNumber(satsToFiat(utxo.value), 2)}
                    </SSText>
                    <SSText size="xs" style={{ color: Colors.gray[500] }}>
                      {fiatCurrency}
                    </SSText>
                  </SSHStack>
                </SSVStack>
              </SSClipboardCopy>
            </SSVStack>
            <SSSeparator color="gradient" />
          </>
        )}
        {utxo && allAccountUtxos.length > 0 && (
          <>
            <SSVStack>
              <SSText uppercase size="md" weight="bold">
                {t('bitcoin.utxos')}
              </SSText>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <SSBubbleChart
                  utxos={allAccountUtxos}
                  canvasSize={{ width: GRAPH_WIDTH, height: GRAPH_HEIGHT }}
                  inputs={currentUtxoInputs}
                  dimUnselected={true}
                  onPress={({ txid, vout }: Utxo) =>
                    router.navigate(
                      `/signer/bitcoin/account/${accountId}/transaction/${txid}/utxo/${vout}`
                    )
                  }
                />
              </GestureHandlerRootView>
            </SSVStack>
            <SSSeparator color="gradient" />
          </>
        )}
        <SSVStack>
          <SSHStack justifyBetween>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {t('common.date')}
              </SSText>
              <SSText color="muted" uppercase>
                {blockTime}
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {t('bitcoin.block')}
              </SSText>
              <SSText color="muted" uppercase>
                {blockHeight}
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {t('common.amount')}
              </SSText>
              <SSClipboardCopy text={amount}>
                <SSText color="muted" uppercase>
                  {amount} {amount !== placeholder ? t('bitcoin.sats') : ''}
                </SSText>
              </SSClipboardCopy>
            </SSVStack>
          </SSHStack>
          <SSSeparator color="gradient" />
          <TouchableOpacity onPress={onPressAddress}>
            <SSVStack gap="sm">
              <SSText weight="bold" uppercase>
                {t('utxo.address')}
              </SSText>
              <SSAddressDisplay address={utxo?.addressTo || '-'} />
            </SSVStack>
          </TouchableOpacity>
          <SSSeparator color="gradient" />
          <TouchableOpacity onPress={onPressTx}>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {t('transaction.id')}
              </SSText>
              <SSText color="muted">{txid}</SSText>
            </SSVStack>
          </TouchableOpacity>
          {tx && (
            <>
              <SSSeparator color="gradient" />
              <SSVStack>
                <SSText uppercase weight="bold" size="md">
                  {t('transaction.details.chart')}
                </SSText>
                <SSTransactionChart
                  transaction={tx}
                  selectedOutputIndex={utxo?.vout}
                  dimUnselected={true}
                />
              </SSVStack>
            </>
          )}
          <SSSeparator color="gradient" />
          <SSClipboardCopy text={vout || ''}>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {t('utxo.outputIndex')}
              </SSText>
              <SSText color="muted">{vout}</SSText>
            </SSVStack>
          </SSClipboardCopy>
          <SSSeparator color="gradient" />
          <SSVStack>
            <SSText uppercase weight="bold">
              {t('utxo.unlockingScript')}
            </SSText>
            <SSScriptDecoded script={utxo?.script || []} />
          </SSVStack>
        </SSVStack>
      </SSVStack>
    </ScrollView>
  )
}

function UtxoDetailsPage() {
  const { id: accountId, txid, vout } = useLocalSearchParams<UtxoSearchParams>()

  const account = useAccountsStore((state) =>
    state.accounts.find((account) => account.id === accountId)
  )

  const tx = account?.transactions.find((tx) => tx.id === txid)

  const utxo = useGetAccountTransactionOutput(accountId!, txid!, Number(vout!))

  const allAccountUtxos = account?.utxos || []

  function navigateToTx() {
    if (!accountId || !txid) return
    router.navigate(`/signer/bitcoin/account/${accountId}/transaction/${txid}`)
  }

  function navigateToAddress() {
    if (!accountId || !utxo || !utxo.addressTo) return
    router.navigate(
      `/signer/bitcoin/account/${accountId}/address/${utxo.addressTo}`
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText>{t('utxo.details.title')}</SSText>
        }}
      />
      <View style={styles.outerContainer}>
        <UtxoDetails
          accountId={accountId || ''}
          onPressAddress={navigateToAddress}
          onPressTx={navigateToTx}
          tx={tx}
          utxo={utxo}
          allAccountUtxos={allAccountUtxos}
        />
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  outerContainer: {
    padding: 20
  },
  innerContainer: {
    flexGrow: 1,
    flexDirection: 'column',
    justifyContent: 'space-between'
  }
})

export { UtxoDetailsPage as default, UtxoDetails, UtxoDetailsPage }
