import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  DimensionValue,
  ScrollView,
  StyleSheet,
  TouchableOpacity
} from 'react-native'

import { SSIconEdit, SSIconIncoming, SSIconOutgoing } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSIconButton from '@/components/SSIconButton'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { usePriceStore } from '@/store/price'
import { Colors } from '@/styles'
import { Transaction } from '@/types/models/Transaction'
import type { TxSearchParams } from '@/types/navigation/searchParams'
import {
  formatDate,
  formatFiatPrice,
  formatLabel,
  formatNumber
} from '@/utils/format'

export default function TxDetails() {
  const { id: accountId, txid } = useLocalSearchParams<TxSearchParams>()

  const [fiatCurrency, btcPrice] = usePriceStore((state) => [
    state.fiatCurrency,
    state.btcPrice,
    state.satsToFiat
  ])

  const tx = useAccountsStore((state) =>
    state.accounts
      .find((account) => account.name === accountId)
      ?.transactions.find((tx) => tx.id === txid)
  )

  const [selectedTags, setSelectedTags] = useState([] as string[])

  const placeholder = '-'
  const placeholder2 = '?'

  const [amount, setAmount] = useState(placeholder2)
  const [fee, setFee] = useState(placeholder)
  const [feePerByte, setFeePerByte] = useState(placeholder)
  const [feePerVByte, setFeePerVByte] = useState(placeholder)
  const [height, setHeight] = useState(placeholder)
  const [label, setLabel] = useState(placeholder)
  const [oldPrice, setOldPrice] = useState(placeholder)
  const [price, setPrice] = useState(placeholder2)
  const [raw, setRaw] = useState(placeholder)
  const [size, setSize] = useState(placeholder)
  const [inputsCount, setInputsCount] = useState(placeholder)
  const [outputsCount, setOutputsCount] = useState(placeholder)
  const [timestamp, setTimestamp] = useState(placeholder)
  const [type, setType] = useState(placeholder)
  const [version, setVersion] = useState(placeholder)
  const [vsize, setVsize] = useState(placeholder)
  const [weight, setWeight] = useState(placeholder)

  function updateInfo() {
    if (!tx) return

    const amount = tx.type === 'receive' ? tx.received : tx.sent

    setAmount(formatNumber(amount))
    setType(tx.type)

    if (btcPrice) setPrice(formatFiatPrice(Number(amount), btcPrice))

    if (tx.prices && tx.prices[fiatCurrency])
      setOldPrice(formatFiatPrice(Number(amount), tx.prices[fiatCurrency]))

    if (tx.blockHeight) setHeight(tx.blockHeight.toString())

    if (tx.size) setSize(tx.size.toString())

    if (tx.vsize) setVsize(tx.vsize.toString())

    if (tx.weight) setWeight(tx.weight.toString())

    if (tx.fee) setFee(tx.fee.toString())

    if (tx.fee && tx.size) setFeePerByte(formatNumber(tx.fee / tx.size))

    if (tx.fee && tx.vsize) setFeePerVByte(formatNumber(tx.fee / tx.vsize))

    if (tx.timestamp) setTimestamp(formatDate(tx.timestamp))

    if (tx.version) setVersion(tx.version.toString())

    if (tx.raw)
      setRaw(tx.raw.map((v) => v.toString(16).padStart(2, '0')).join(' '))

    if (tx.vin) setInputsCount(tx.vin.length.toString())

    if (tx.vout) setOutputsCount(tx.vout.length.toString())

    const rawLabel = tx.label || ''
    const { label, tags } = formatLabel(rawLabel)
    setLabel(label)
    setSelectedTags(tags)
  }

  useEffect(() => {
    try {
      updateInfo()
    } catch {
      router.back()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx])

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText>TX Details</SSText>
        }}
      />
      <SSVStack style={styles.container}>
        <SSVStack gap="none" style={{ alignItems: 'center' }}>
          <SSHStack gap="xxs" style={{ alignItems: 'baseline', width: 'auto' }}>
            <SSText size="4xl" style={{ lineHeight: 30 }}>
              {amount}
            </SSText>
            <SSText color="muted">
              {i18n.t('bitcoin.sats').toLowerCase()}
            </SSText>
          </SSHStack>
          <SSText color="muted">
            {price} {fiatCurrency}
          </SSText>
          {timestamp !== '-' && (
            <SSHStack gap="xs">
              {type === 'receive' && <SSIconIncoming height={12} width={12} />}
              {type === 'send' && <SSIconOutgoing height={12} width={12} />}
              <SSText center color="muted">
                {timestamp}
              </SSText>
            </SSHStack>
          )}
          {oldPrice !== '-' && (
            <SSText center color="muted">
              ({oldPrice}) {fiatCurrency}
            </SSText>
          )}
        </SSVStack>
        <SSSeparator color="gradient" />
        <SSVStack gap="sm">
          <SSHStack justifyBetween>
            <SSText size="md">{label || i18n.t('account.noLabel')}</SSText>
            <SSIconButton
              onPress={() =>
                router.navigate(
                  `/account/${accountId}/transaction/${txid}/label`
                )
              }
            >
              <SSIconEdit height={32} width={32} />
            </SSIconButton>
          </SSHStack>
          <SSHStack gap="sm">
            {selectedTags.map((tag) => (
              <SSButton
                key={tag}
                label={tag}
                uppercase={false}
                style={styles.button}
              />
            ))}
          </SSHStack>
        </SSVStack>
        <SSSeparator color="gradient" />
        <SSClipboardCopy text={height}>
          <SSTxDetailsBox header="IN BLOCK" text={height} />
        </SSClipboardCopy>
        <SSSeparator color="gradient" />
        <SSClipboardCopy text={txid}>
          <SSTxDetailsBox header="TRANSACTION HASH" text={txid} />
        </SSClipboardCopy>
        <SSSeparator color="gradient" />
        <SSHStack>
          <SSTxDetailsBox header="RAW SIZE" text={size} width="33%" />
          <SSTxDetailsBox header="WEIGHT" text={weight} width="33%" />
          <SSTxDetailsBox header="VIRTUAL SIZE" text={vsize} width="33%" />
        </SSHStack>
        <SSSeparator color="gradient" />
        <SSHStack>
          <SSTxDetailsBox header="FEE" text={fee} width="33%" />
          <SSTxDetailsBox header="FEE SAT/B" text={feePerByte} width="33%" />
          <SSTxDetailsBox header="FEE SAT/VB" text={feePerVByte} width="33%" />
        </SSHStack>
        <SSSeparator color="gradient" />
        <SSTxDetailsBox header="Transaction raw" text={raw} />
        <SSSeparator color="gradient" />
        <SSVStack gap="none">
          <SSText weight="bold" size="md">
            TRANSACTION DECODED
          </SSText>
        </SSVStack>
        <SSTxDetailsBox header="Version" text={version} />
        <SSTxDetailsBox header="Number of inputs" text={inputsCount} />
        <SSTxDetailsBox header="Number of outputs" text={outputsCount} />
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
}

function SSTxDetailsBox({
  header,
  text = '-',
  width = '100%'
}: SSTxDetailsBoxProps) {
  return (
    <SSVStack gap="none" style={{ width }}>
      <SSText weight="bold" size="md">
        {header}
      </SSText>
      <SSText color="muted">{text}</SSText>
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
            Input {index}
          </SSText>
          <SSVStack gap="none">
            <SSText weight="bold">Previous TX Output hash</SSText>
            <SSClipboardCopy text={vin.previousOutput.txid}>
              <SSText color="muted">{vin.previousOutput.txid}</SSText>
            </SSClipboardCopy>
          </SSVStack>
          <SSVStack gap="none">
            <SSText weight="bold">Output index in transaction</SSText>
            <SSText color="muted">{vin.previousOutput.vout}</SSText>
          </SSVStack>
          <SSVStack gap="none">
            <SSText weight="bold">Sequence</SSText>
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
          <SSVStack key={index}>
            <SSSeparator color="gradient" />
            <TouchableOpacity
              onPress={() =>
                router.navigate(
                  `/account/${accountId}/transaction/${tx.id}/utxo/${index}`
                )
              }
            >
              <SSText weight="bold" center>
                Output {index}
              </SSText>
            </TouchableOpacity>
            <SSVStack gap="none">
              <SSText weight="bold">Value</SSText>
              <SSText color="muted">{vout.value}</SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText weight="bold">Address</SSText>
              <SSClipboardCopy text={vout.address}>
                <SSText color="muted">{vout.address}</SSText>
              </SSClipboardCopy>
            </SSVStack>
          </SSVStack>
        ))}
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  button: {
    //
    backgroundColor: Colors.gray[500],
    borderRadius: 5,
    borderStyle: 'solid',
    paddingHorizontal: 8,
    height: 'auto',
    width: 'auto'
  },
  container: {
    //
    flexGrow: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: 20
  }
})
