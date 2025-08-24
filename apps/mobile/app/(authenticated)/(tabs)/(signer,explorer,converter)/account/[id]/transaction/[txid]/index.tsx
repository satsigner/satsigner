import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  type DimensionValue,
  ScrollView,
  StyleSheet,
  TouchableOpacity
} from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { getTransactionInputValues } from '@/api/bdk'
import { SSIconIncoming, SSIconOutgoing } from '@/components/icons'
import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSLabelDetails from '@/components/SSLabelDetails'
import SSScriptDecoded from '@/components/SSScriptDecoded'
import SSSeparator from '@/components/SSSeparator'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import SSTimeAgoText from '@/components/SSTimeAgoText'
import SSTransactionChart from '@/components/SSTransactionChart'
import SSTransactionDecoded from '@/components/SSTransactionDecoded'
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
import { getUtxoOutpoint } from '@/utils/utxo'

export default function TxDetails() {
  const { id: accountId, txid } = useLocalSearchParams<TxSearchParams>()

  const [tx, loadTx] = useAccountsStore(
    useShallow((state) => [
      state.accounts
        .find((account) => account.id === accountId)
        ?.transactions.find((tx) => tx.id === txid),
      state.loadTx
    ])
  )

  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )

  const currentServer = configs[selectedNetwork].server

  const placeholder = '-'

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
          link={`/account/${accountId}/transaction/${txid}/label`}
          header={t('transaction.label')}
        />
        <SSSeparator color="gradient" />
        <SSVStack>
          <SSText uppercase weight="bold" size="md">
            {t('transaction.details.chart')}
          </SSText>
          <SSTransactionChart transaction={tx} />
        </SSVStack>
        <SSSeparator color="gradient" />
        <SSClipboardCopy text={height}>
          <SSTxDetailsBox header={t('transaction.block')} text={height} />
        </SSClipboardCopy>
        <SSSeparator color="gradient" />
        <SSClipboardCopy text={txid}>
          <SSTxDetailsBox header={t('transaction.hash')} text={txid} />
        </SSClipboardCopy>
        <SSSeparator color="gradient" />
        <SSHStack>
          <SSTxDetailsBox
            header={t('transaction.size')}
            text={size}
            width="33%"
          />
          <SSTxDetailsBox
            header={t('transaction.weight')}
            text={weight}
            width="33%"
          />
          <SSTxDetailsBox
            header={t('transaction.vsize')}
            text={vsize}
            width="33%"
          />
        </SSHStack>
        <SSSeparator color="gradient" />
        <SSHStack>
          <SSTxDetailsBox
            header={t('transaction.fee')}
            text={fee}
            width="33%"
          />
          <SSTxDetailsBox
            header={t('transaction.feeBytes')}
            text={feePerByte}
            width="33%"
          />
          <SSTxDetailsBox
            header={t('transaction.feeVBytes')}
            text={feePerVByte}
            width="33%"
          />
        </SSHStack>
        <SSSeparator color="gradient" />
        <SSVStack gap="sm">
          <SSText
            uppercase
            weight="bold"
            size="md"
            style={{ marginBottom: -30 }}
          >
            {t('transaction.decoded.title')}
          </SSText>
          {raw !== '' ? (
            <SSTransactionDecoded txHex={raw} />
          ) : (
            <SSText>{placeholder}</SSText>
          )}
        </SSVStack>
        <SSSeparator color="gradient" />
        <SSVStack gap="none">
          <SSText uppercase weight="bold" size="lg">
            {t('transaction.details.title')}
          </SSText>
        </SSVStack>
        <SSTxDetailsBox header={t('transaction.version')} text={version} />
        <SSTxDetailsBox
          header={t('transaction.input.count')}
          text={inputsCount}
        />
        <SSTxDetailsBox
          header={t('transaction.output.count')}
          text={outputsCount}
        />
        <SSTxDetailsInputs tx={tx} />
        <SSTxDetailsOutputs tx={tx} accountId={accountId} />
      </SSVStack>
    </ScrollView>
  )
}

type SSTxDetailsBoxProps = {
  header: string
  text?: string | number | undefined
  variant?: 'mono' | 'sans-serif'
  width?: DimensionValue
  uppercase?: boolean
}

function SSTxDetailsBox({
  header,
  text = '-',
  width = '100%',
  variant = 'sans-serif',
  uppercase = true
}: SSTxDetailsBoxProps) {
  const gap = variant === 'mono' ? 'sm' : 'none'
  return (
    <SSVStack gap={gap} style={{ width }}>
      <SSText uppercase={uppercase} weight="bold" size="md">
        {header}
      </SSText>
      <SSText color="muted" type={variant}>
        {text}
      </SSText>
    </SSVStack>
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

  const getBlockchainHeight = useBlockchainStore(
    (state) => state.getBlockchainHeight
  )

  const useZeroPadding = useSettingsStore((state) => state.useZeroPadding)

  const [amount, setAmount] = useState(0)
  const [confirmations, setConfirmations] = useState(0)
  const [oldPrice, setOldPrice] = useState('')
  const [price, setPrice] = useState('')
  const [type, setType] = useState('')
  const [inputsCount, setInputsCount] = useState(0)

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

    if (tx.blockHeight) {
      const blockchainHeight = await getBlockchainHeight()
      const confirmations = blockchainHeight - tx.blockHeight
      setConfirmations(confirmations)
    }
  }

  useEffect(() => {
    updateInfo()
  }, [tx]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SSVStack gap="none" style={{ alignItems: 'center' }}>
      {tx?.timestamp && <SSTimeAgoText date={new Date(tx.timestamp)} />}
      <SSHStack gap="sm" style={{ alignItems: 'center' }}>
        {type === 'receive' && <SSIconIncoming height={12} width={12} />}
        {type === 'send' && <SSIconOutgoing height={12} width={12} />}
        <SSHStack gap="sm" style={{ alignItems: 'baseline' }}>
          <SSHStack gap="xs" style={{ alignItems: 'baseline', width: 'auto' }}>
            {amount !== 0 ? (
              <SSStyledSatText
                amount={Math.abs(amount)}
                decimals={0}
                useZeroPadding={useZeroPadding}
                type={tx?.type}
                weight="light"
              />
            ) : (
              <SSText color="muted">?</SSText>
            )}
            <SSText color="muted">{t('bitcoin.sats').toLowerCase()}</SSText>
          </SSHStack>
          <SSHStack gap="xs">
            {price && <SSText>{price}</SSText>}
            {oldPrice && <SSText color="muted">({oldPrice})</SSText>}
            {(price || oldPrice) && (
              <SSText color="muted">{fiatCurrency}</SSText>
            )}
          </SSHStack>
        </SSHStack>
      </SSHStack>
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

type SSTxDetailsInputsProps = {
  tx: Transaction | undefined
}

function SSTxDetailsInputs({ tx }: SSTxDetailsInputsProps) {
  return (
    <SSVStack>
      {(tx?.vin || []).map((vin, index) => (
        <SSVStack key={index}>
          <SSSeparator color="gradient" />
          <SSText weight="bold" center>
            {t('transaction.input.title')} {index}
          </SSText>
          <SSVStack gap="none">
            <SSText weight="bold">
              {t('transaction.input.previousOutput.transaction')}
            </SSText>
            <SSClipboardCopy text={vin.previousOutput.txid}>
              <SSText color="muted">{vin.previousOutput.txid}</SSText>
            </SSClipboardCopy>
          </SSVStack>
          <SSVStack gap="none">
            <SSText weight="bold">
              {t('transaction.input.previousOutput.vout')}
            </SSText>
            <SSText color="muted">{vin.previousOutput.vout}</SSText>
          </SSVStack>
          <SSVStack gap="none">
            <SSText weight="bold">{t('transaction.input.sequence')}</SSText>
            <SSText color="muted">{vin.sequence}</SSText>
          </SSVStack>
          <SSVStack>
            <SSText weight="bold">{t('transaction.input.scriptSig')}</SSText>
            <SSScriptDecoded script={vin.scriptSig || []} />
          </SSVStack>
        </SSVStack>
      ))}
    </SSVStack>
  )
}

type SSTxDetailsOutputsProps = {
  tx: Transaction | undefined
  accountId: string
}

function SSTxDetailsOutputs({ tx, accountId }: SSTxDetailsOutputsProps) {
  const account = useAccountsStore((state) =>
    state.accounts.find((account) => account.name === accountId)
  )

  const utxoDict: Record<string, boolean> = {}
  const addressDict: Record<string, boolean> = {}

  if (account) {
    account.utxos.forEach((utxo) => (utxoDict[getUtxoOutpoint(utxo)] = true))
    account.addresses.forEach((addr) => (addressDict[addr.address] = true))
  }

  return (
    <SSVStack>
      {tx &&
        (tx?.vout || []).map((output, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => {
              if (utxoDict[`${tx.id}:${index}`]) {
                router.navigate(
                  `/account/${accountId}/transaction/${tx.id}/utxo/${index}`
                )
              }
            }}
          >
            <SSVStack key={`${tx.id}:${index}`}>
              <SSSeparator color="gradient" />
              <SSText weight="bold" center>
                {t('transaction.output.title')} {index}
              </SSText>
              <SSTxDetailsBox
                header={t('transaction.value')}
                text={output.value}
              />
              <TouchableOpacity
                onPress={() => {
                  if (addressDict[output.address]) {
                    router.navigate(
                      `/account/${accountId}/address/${output.address}`
                    )
                  }
                }}
              >
                <SSVStack gap="sm">
                  <SSText uppercase weight="bold" size="md">
                    {t('bitcoin.address')}
                  </SSText>
                  <SSAddressDisplay
                    address={output.address}
                    copyToClipboard={false}
                    variant="bare"
                    color="muted"
                    size="sm"
                  />
                </SSVStack>
              </TouchableOpacity>
              <SSVStack>
                <SSText uppercase weight="bold" size="md">
                  {t('transaction.unlockingScript')}
                </SSText>
                <SSScriptDecoded script={output.script || []} />
              </SSVStack>
            </SSVStack>
          </TouchableOpacity>
        ))}
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: 20
  }
})
