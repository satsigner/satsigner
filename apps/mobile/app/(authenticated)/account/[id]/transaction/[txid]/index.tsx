import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  DimensionValue,
  ScrollView,
  StyleSheet,
  TouchableOpacity
} from 'react-native'

import { SSIconIncoming, SSIconOutgoing } from '@/components/icons'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { Colors } from '@/styles'
import { Transaction } from '@/types/models/Transaction'
import type { TxSearchParams } from '@/types/navigation/searchParams'
import {
  formatConfirmations,
  formatDate,
  formatFiatPrice,
  formatNumber
} from '@/utils/format'
import { SSLabelDetails } from '@/components/SSLabelDetails'

// TODO: Refactor page

const t = (translate: string) => i18n.t(`txDetails.${translate}`)

export default function TxDetails() {
  const { id: accountId, txid } = useLocalSearchParams<TxSearchParams>()

  const tx = useAccountsStore((state) =>
    state.accounts
      .find((account) => account.name === accountId)
      ?.transactions.find((tx) => tx.id === txid)
  )

  const placeholder = '-'

  const [fee, setFee] = useState(placeholder)
  const [feePerByte, setFeePerByte] = useState(placeholder)
  const [feePerVByte, setFeePerVByte] = useState(placeholder)
  const [height, setHeight] = useState(placeholder)
  const [raw, setRaw] = useState(placeholder)
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

    if (tx.raw)
      setRaw(tx.raw.map((v) => v.toString(16).padStart(2, '0')).join(' '))

    if (tx.vin) setInputsCount(tx.vin.length.toString())

    if (tx.vout) setOutputsCount(tx.vout.length.toString())
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
          headerTitle: () => <SSText>{i18n.t('txDetails.title')}</SSText>
        }}
      />
      <SSVStack style={styles.container}>
        <SSTxDetailsHeader tx={tx} />
        <SSSeparator color="gradient" />
        <SSLabelDetails
          label={tx.label || ''}
          link={`/account/${accountId}/transaction/${txid}/label`}
          header={t('label')}
        />
        <SSSeparator color="gradient" />
        <SSClipboardCopy text={height}>
          <SSTxDetailsBox header={t('block')} text={height} />
        </SSClipboardCopy>
        <SSSeparator color="gradient" />
        <SSClipboardCopy text={txid}>
          <SSTxDetailsBox header={t('hash')} text={txid} />
        </SSClipboardCopy>
        <SSSeparator color="gradient" />
        <SSHStack>
          <SSTxDetailsBox header={t('size')} text={size} width="33%" />
          <SSTxDetailsBox header={t('weight')} text={weight} width="33%" />
          <SSTxDetailsBox header={t('vsize')} text={vsize} width="33%" />
        </SSHStack>
        <SSSeparator color="gradient" />
        <SSHStack>
          <SSTxDetailsBox header={t('fee')} text={fee} width="33%" />
          <SSTxDetailsBox
            header={t('feeBytes')}
            text={feePerByte}
            width="33%"
          />
          <SSTxDetailsBox
            header={t('feeVBytes')}
            text={feePerVByte}
            width="33%"
          />
        </SSHStack>
        <SSSeparator color="gradient" />
        <SSTxDetailsBox header={t('raw')} text={raw} />
        <SSSeparator color="gradient" />
        <SSVStack gap="none">
          <SSText uppercase weight="bold" size="lg">
            {t('decoded')}
          </SSText>
        </SSVStack>
        <SSTxDetailsBox header={t('version')} text={version} />
        <SSTxDetailsBox header={t('inputsCount')} text={inputsCount} />
        <SSTxDetailsBox header={t('outputsCount')} text={outputsCount} />
        <SSTxDetailsInputs tx={tx} />
        <SSTxDetailsOutputs tx={tx} accountId={accountId} />
      </SSVStack>
    </ScrollView>
  )
}

type SSTxDetailsBoxProps = {
  header: string
  text?: string | number | undefined
  width?: DimensionValue
  uppercase?: boolean
}

function SSTxDetailsBox({
  header,
  text = '-',
  width = '100%',
  uppercase = true
}: SSTxDetailsBoxProps) {
  return (
    <SSVStack gap="none" style={{ width }}>
      <SSText uppercase={uppercase} weight="bold" size="md">
        {header}
      </SSText>
      <SSText color="muted">{text}</SSText>
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

  const [amount, setAmount] = useState('')
  const [confirmations, setConfirmations] = useState(0)
  const [oldPrice, setOldPrice] = useState('')
  const [price, setPrice] = useState('')
  const [timestamp, setTimestamp] = useState('')
  const [type, setType] = useState('')
  const [inputsCount, setInputsCount] = useState(0)

  const updateInfo = async () => {
    if (!tx) return

    const amount = tx.type === 'receive' ? tx.received : tx.sent

    setAmount(formatNumber(amount))
    setType(tx.type)

    if (btcPrice) setPrice(formatFiatPrice(Number(amount), btcPrice))

    if (tx.prices) {
    }
    setOldPrice(formatFiatPrice(Number(amount), tx.prices[fiatCurrency] || 0))

    if (tx.timestamp) setTimestamp(formatDate(tx.timestamp))

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
      {timestamp && (
        <SSHStack gap="xs">
          {type === 'receive' && <SSIconIncoming height={12} width={12} />}
          {type === 'send' && <SSIconOutgoing height={12} width={12} />}
          <SSText center color="muted">
            {timestamp}
          </SSText>
        </SSHStack>
      )}
      <SSHStack>
        <SSHStack gap="xs" style={{ alignItems: 'baseline', width: 'auto' }}>
          <SSText size="xl" style={{ lineHeight: 30 }}>
            {amount}
          </SSText>
          <SSText color="muted">{i18n.t('bitcoin.sats').toLowerCase()}</SSText>
        </SSHStack>
        <SSHStack gap="xs">
          {price && <SSText>{price}</SSText>}
          {oldPrice && <SSText color="muted">({oldPrice})</SSText>}
          {(price || oldPrice) && <SSText color="muted">{fiatCurrency}</SSText>}
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
          <SSText color="muted">{i18n.t('common.from').toLowerCase()}</SSText>
          <SSText>{inputsCount || '?'} inputs</SSText>
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
            {t('input')} {index}
          </SSText>
          <SSVStack gap="none">
            <SSText weight="bold">{t('inputPrevTx')}</SSText>
            <SSClipboardCopy text={vin.previousOutput.txid}>
              <SSText color="muted">{vin.previousOutput.txid}</SSText>
            </SSClipboardCopy>
          </SSVStack>
          <SSVStack gap="none">
            <SSText weight="bold">{t('inputPrevOut')}</SSText>
            <SSText color="muted">{vin.previousOutput.vout}</SSText>
          </SSVStack>
          <SSVStack gap="none">
            <SSText weight="bold">{t('inputSequence')}</SSText>
            <SSText color="muted">{vin.sequence}</SSText>
          </SSVStack>
          <SSText weight="bold">SigScript</SSText>
          <SSVStack gap="sm">
            <SSVStack gap="none">
              <SSText size="xxs" weight="bold">
                OP_DUP
              </SSText>
              <SSText size="xxs" color="muted">
                0x72
              </SSText>
              <SSText size="xxs" color="muted">
                Duplicates the top stack item
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText size="xxs" weight="bold">
                OP_HASH160
              </SSText>
              <SSText size="xxs" color="muted">
                0xa9
              </SSText>
              <SSText size="xxs" color="muted">
                The input is hashed twice: first with SHA-256 and then with
                RIPEMD-160.
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText size="xxs" weight="bold">
                76A9145E4FF47CEB3A51CDF7DDD80AFC4ACC5A692DAC2D88AC
              </SSText>
              <SSText size="xxs" color="muted">
                Raw data
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText size="xxs" weight="bold">
                OP_EQUALVERIFY
              </SSText>
              <SSText size="xxs" color="muted">
                0x88
              </SSText>
              <SSText size="xxs" color="muted">
                Returns 1 if the inputs are exactly equal, 0 otherwise.
                Afterward, OP_VERIFY is executed.
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText size="xxs" weight="bold">
                OP_CHECK_SIG
              </SSText>
              <SSText size="xxs" color="muted">
                0xacc
              </SSText>
              <SSText size="xxs" color="muted">
                The entire transaction's outputs, inputs, and script (from the
                most recently-executed OP_CODESEPARATOR to the end) are hashed.
                The signature used by OP_CHECKSIG must be a valid signature for
                this hash and public key. If it is, 1 is returned, 0 otherwise.
                Afterward, OP_VERIFY is executed.
              </SSText>
            </SSVStack>
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
  return (
    <SSVStack>
      {tx &&
        (tx?.vout || []).map((vout, index) => (
          <TouchableOpacity
            key={index}
            onPress={() =>
              router.navigate(
                `/account/${accountId}/transaction/${tx.id}/utxo/${index}`
              )
            }
          >
            <SSVStack key={`${tx.id}:${index}`}>
              <SSSeparator color="gradient" />
              <SSText weight="bold" center>
                {t('output')} {index}
              </SSText>
              <SSTxDetailsBox
                header={i18n.t('common.value')}
                text={vout.value}
              />
              <SSTxDetailsBox
                header={i18n.t('common.address')}
                text={vout.address}
              />
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
