import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'

import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSLabelDetails from '@/components/SSLabelDetails'
import SSScriptDecoded from '@/components/SSScriptDecoded'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
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
  utxo
}: UtxoDetailsProps) {
  const placeholder = '-'
  const [blockTime, setBlockTime] = useState(placeholder)
  const [blockHeight, setBlockHeight] = useState(placeholder)
  const [amount, setAmount] = useState(placeholder)
  const [txid, setTxid] = useState(placeholder)
  const [vout, setVout] = useState(placeholder)

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
            link={`/account/${accountId}/transaction/${txid}/utxo/${vout}/label`}
            header={t('utxo.label')}
          />
        </SSVStack>
        <SSVStack>
          <SSSeparator color="gradient" />
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

  const [tx, utxo] = useAccountsStore((state) => [
    state.accounts
      .find((account) => account.id === accountId)
      ?.transactions.find((tx) => tx.id === txid),
    state.accounts
      .find((account) => account.id === accountId)
      ?.utxos.find((u) => u.txid === txid && u.vout === Number(vout))
  ])

  function navigateToTx() {
    if (!accountId || !txid) return
    router.navigate(`/account/${accountId}/transaction/${txid}`)
  }

  function navigateToAddress() {
    if (!accountId || !utxo || !utxo.addressTo) return
    router.navigate(`/account/${accountId}/address/${utxo.addressTo}`)
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
