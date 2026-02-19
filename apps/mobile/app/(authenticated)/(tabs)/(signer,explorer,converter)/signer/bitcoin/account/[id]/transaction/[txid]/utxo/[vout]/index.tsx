import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useShallow } from 'zustand/react/shallow'

import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSBubbleChart from '@/components/SSBubbleChart'
import SSButton from '@/components/SSButton'
import SSDetailsList from '@/components/SSDetailsList'
import SSLabelDetails from '@/components/SSLabelDetails'
import SSScriptDecoded from '@/components/SSScriptDecoded'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSTransactionChart from '@/components/SSTransactionChart'
import useGetAccountTransactionOutput from '@/hooks/useGetAccountTransactionOutput'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { usePriceStore } from '@/store/price'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type UtxoSearchParams } from '@/types/navigation/searchParams'
import { formatDate, formatNumber } from '@/utils/format'

type UtxoDetailsProps = {
  accountId: string
  onPressAddress: () => void
  onPressTx: () => void
  onSpendUtxo: () => void
  tx?: Transaction
  utxo?: Utxo
}

function UtxoDetails({
  accountId,
  onPressAddress,
  onPressTx,
  onSpendUtxo,
  tx,
  utxo,
  allAccountUtxos
}: UtxoDetailsProps & { allAccountUtxos: Utxo[] }) {
  const [blockTime, setBlockTime] = useState('')
  const [blockHeight, setBlockHeight] = useState('')
  const [value, setValue] = useState('')
  const [fiatValue, setFiatValue] = useState('')
  const [txid, setTxid] = useState('')
  const [vout, setVout] = useState('')

  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
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
      setVout(utxo.vout.toString())
      const { value } = utxo
      if (value) {
        setValue(formatNumber(value))
        const fiatValue = formatNumber(satsToFiat(value), 2)
        setFiatValue(`${fiatValue} ${fiatCurrency}`)
      }
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
        {utxo && allAccountUtxos.length > 0 && (
          <>
            <SSVStack>
              <SSText uppercase weight="bold" size="md">
                {t('bitcoin.utxo')}
              </SSText>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <SSBubbleChart
                  utxos={allAccountUtxos}
                  canvasSize={{ width: GRAPH_WIDTH, height: GRAPH_HEIGHT }}
                  inputs={currentUtxoInputs}
                  dimUnselected
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
        <SSLabelDetails
          label={utxo?.label || ''}
          link={`/signer/bitcoin/account/${accountId}/transaction/${txid}/utxo/${vout}/label`}
          header={t('utxo.label')}
        />
        <SSSeparator color="gradient" />
        <SSVStack>
          <TouchableOpacity
            onPress={onPressAddress}
            activeOpacity={0.7}
            disabled={!utxo?.addressTo || utxo.addressTo === '-'}
          >
            <SSVStack gap="sm">
              <SSText weight="bold" uppercase>
                {t('utxo.address')}
              </SSText>
              <SSAddressDisplay
                address={utxo?.addressTo || '-'}
                copyToClipboard={false}
              />
            </SSVStack>
          </TouchableOpacity>
          <SSSeparator color="gradient" />
          <TouchableOpacity onPress={onPressTx} activeOpacity={0.7}>
            <SSVStack gap="sm">
              <SSText weight="bold" uppercase>
                {t('transaction.id')}
              </SSText>
              <SSAddressDisplay address={txid} copyToClipboard={false} />
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
                  dimUnselected
                />
              </SSVStack>
            </>
          )}
          <SSSeparator color="gradient" />
          <SSDetailsList
            columns={2}
            items={[
              [t('common.date'), blockTime],
              [t('bitcoin.block'), blockHeight],
              [t('common.value'), value],
              [t('common.valueFiat'), fiatValue],
              [t('utxo.outputIndex'), vout]
            ]}
          />
          <SSSeparator color="gradient" />
          <SSVStack>
            <SSText weight="bold" uppercase>
              {t('utxo.unlockingScript')}
            </SSText>
            <SSScriptDecoded script={utxo?.script || []} />
          </SSVStack>
          <SSSeparator color="gradient" />
          <SSButton
            variant="secondary"
            label={t('utxo.spend')}
            onPress={onSpendUtxo}
          />
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
  const addInput = useTransactionBuilderStore((state) => state.addInput)

  function navigateToTx() {
    if (!accountId || !txid) return
    router.navigate(`/signer/bitcoin/account/${accountId}/transaction/${txid}`)
  }

  function navigateToAddress() {
    if (!accountId || !utxo || !utxo.addressTo || utxo.addressTo === '-') return
    router.navigate(
      `/signer/bitcoin/account/${accountId}/address/${utxo.addressTo}`
    )
  }

  function handleSpendUtxo() {
    if (!utxo || !accountId) return
    addInput(utxo)
    router.navigate(
      `/signer/bitcoin/account/${accountId}/signAndSend/ioPreview`
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
          onSpendUtxo={handleSpendUtxo}
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
