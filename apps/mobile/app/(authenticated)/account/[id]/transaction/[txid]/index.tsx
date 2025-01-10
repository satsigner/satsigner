import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { ScrollView } from 'react-native'

import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSSeparator from '@/components/SSSeparator'
import SSTagInput from '@/components/SSTagInput'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { usePriceStore } from '@/store/price'
import type { TxSearchParams } from '@/types/navigation/searchParams'
import {
  formatDate,
  formatLabel,
  formatFiatPrice,
  formatNumber
} from '@/utils/format'
import { useEffect, useState } from 'react'
import { Transaction } from '@/types/models/Transaction'
import { SSIconEdit, SSIconIncoming, SSIconOutgoing } from '@/components/icons'
import { Colors } from '@/styles'
import BScript from 'bscript-parser'

export default function TxDetails() {
  const { id: accountId, txid } = useLocalSearchParams<TxSearchParams>()

  const [fiatCurrency, btcPrice, satsToFiat] = usePriceStore((state) => [
    state.fiatCurrency,
    state.btcPrice,
    state.satsToFiat
  ])

  const [account, getTags, setTags, getTx] = useAccountsStore((state) => [
    state.accounts.find((account) => account.name === accountId),
    state.getTags,
    state.setTags,
    state.getTx
  ])

  const [tx, setTx] = useState({} as Transaction)
  const [tags, setLocalTags] = useState(getTags())
  const [selectedTags, setSelectedTags] = useState([] as string[])
  const [label, setLabel] = useState('')
  const [originalLabel, setOriginalLabel] = useState('')

  const placeholder = () => useState('-')

  const [amount, setAmount] = placeholder()
  const [fee, setFee] = placeholder()
  const [feePerByte, setFeePerByte] = placeholder()
  const [feePerVByte, setFeePerVByte] = placeholder()
  const [height, setHeight] = placeholder()
  const [oldPrice, setOldPrice] = placeholder()
  const [price, setPrice] = placeholder()
  const [raw, setRaw] = placeholder()
  const [size, setSize] = placeholder()
  const [timestamp, setTimestamp] = placeholder()
  const [type, setType] = placeholder()
  const [version, setVersion] = placeholder()
  const [vsize, setVsize] = placeholder()
  const [weight, setWeight] = placeholder()

  const fetchTxInfo = () => {
    const tx = getTx(accountId, txid)

    if (!tx) return

    const amount = tx.type === 'receive' ? tx.received : tx.sent

    setTx(tx)
    setType(tx.type)
    setAmount(formatNumber(amount))

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

    const rawLabel = tx.label || ''
    const { label, tags } = formatLabel(rawLabel)
    setOriginalLabel(rawLabel)
    setLabel(label)
    setSelectedTags(tags)
  }

  useEffect(fetchTxInfo, [])

  const saveLabel = () => {
    let newLabel = label.trim()
    setLabel(newLabel)

    if (selectedTags.length > 0) newLabel += ' tags:' + selectedTags.join(',')

    // if (newLabel !== originalLabel)
    // setUtxoLabel(accountId, txid, Number(vout), newLabel)

    router.back()
  }

  const onAddTag = (tag: string) => {
    if (!tags.includes(tag)) {
      const allTags = [...tags, tag]
      setTags(allTags)
      setLocalTags(allTags)
    }
    const selected = [...selectedTags, tag]
    setSelectedTags(selected)
  }

  const onDelTag = (tag: string) => {
    const selected = selectedTags.filter((t) => t !== tag)
    setSelectedTags(selected)
  }

  if (!account) return <Redirect href="/" />

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{account.name}</SSText>
        }}
      />
      <SSVStack
        style={{
          flexGrow: 1,
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 20
        }}
      >
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
          <SSHStack gap="xs">
            {type === 'receive' && <SSIconIncoming height={12} width={12} />}
            {type === 'send' && <SSIconOutgoing height={12} width={12} />}
            <SSText center color="muted">
              {timestamp}
            </SSText>
          </SSHStack>
          {oldPrice !== '-' && (
            <SSText center color="muted">
              ({oldPrice}) {fiatCurrency}
            </SSText>
          )}
        </SSVStack>
        <SSSeparator color="gradient" />
        <SSVStack gap="none">
          <SSHStack justifyBetween>
            <SSText size="md">{label || i18n.t('account.noLabel')}</SSText>
            <SSIconEdit height={32} width={32} />
          </SSHStack>
          <SSHStack gap="sm">
            {selectedTags.map((tag) => (
              <SSButton
                key={tag}
                label={tag}
                uppercase={false}
                style={{
                  backgroundColor: Colors.gray[500],
                  borderRadius: 5,
                  borderStyle: 'solid',
                  paddingHorizontal: 8,
                  height: 'auto',
                  width: 'auto'
                }}
              />
            ))}
          </SSHStack>
        </SSVStack>
        <SSSeparator color="gradient" />
        <SSClipboardCopy text={height}>
          <SSVStack gap="none">
            <SSText weight="bold" size="md">
              IN BLOCK
            </SSText>
            <SSText color="muted">{height}</SSText>
          </SSVStack>
        </SSClipboardCopy>
        <SSSeparator color="gradient" />
        <SSClipboardCopy text={txid}>
          <SSVStack gap="none">
            <SSText weight="bold" size="md">
              TRANSACTION HASH
            </SSText>
            <SSText color="muted">{txid}</SSText>
          </SSVStack>
        </SSClipboardCopy>
        <SSSeparator color="gradient" />
        <SSHStack>
          <SSVStack gap="none" style={{ width: '33%' }}>
            <SSText weight="bold" size="md">
              RAW SIZE
            </SSText>
            <SSText color="muted">{size}</SSText>
          </SSVStack>
          <SSVStack gap="none" style={{ width: '33%' }}>
            <SSText weight="bold" size="md">
              WEIGHT
            </SSText>
            <SSText color="muted">{weight}</SSText>
          </SSVStack>
          <SSVStack gap="none" style={{ width: '33%' }}>
            <SSText weight="bold" size="md">
              VIRTUAL SIZE
            </SSText>
            <SSText color="muted">{vsize}</SSText>
          </SSVStack>
        </SSHStack>
        <SSSeparator color="gradient" />
        <SSHStack>
          <SSVStack gap="none" style={{ width: '33%' }}>
            <SSText weight="bold" size="md">
              FEES
            </SSText>
            <SSText color="muted">{fee}</SSText>
          </SSVStack>
          <SSVStack gap="none" style={{ width: '33%' }}>
            <SSText weight="bold" size="md">
              FEE SAT/B
            </SSText>
            <SSText color="muted">{feePerByte}</SSText>
          </SSVStack>
          <SSVStack gap="none" style={{ width: '33%' }}>
            <SSText weight="bold" size="md">
              FEE SAT/VB
            </SSText>
            <SSText color="muted">{feePerVByte}</SSText>
          </SSVStack>
        </SSHStack>
        <SSSeparator color="gradient" />
        <SSVStack gap="none">
          <SSText weight="bold" size="md">
            TRANSACTION RAW
          </SSText>
          <SSText color="muted">{raw}</SSText>
        </SSVStack>
        <SSSeparator color="gradient" />
        <SSVStack gap="none">
          <SSText weight="bold" size="md">
            TRANSACTION DECODED
          </SSText>
        </SSVStack>
        <SSVStack gap="none">
          <SSText weight="bold" size="md">
            Version
          </SSText>
          <SSText color="muted">{version}</SSText>
        </SSVStack>
        <SSVStack gap="none">
          <SSText weight="bold" size="md">
            Number of inputs
          </SSText>
          <SSText color="muted">{tx?.vin?.length || '-'}</SSText>
        </SSVStack>
        <SSVStack gap="none">
          <SSText weight="bold" size="md">
            Number of outputs
          </SSText>
          <SSText color="muted">{tx?.vout?.length || '-'}</SSText>
        </SSVStack>
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
                    The entire transaction's outputs, inputs, and script (from
                    the most recently-executed OP_CODESEPARATOR to the end) are
                    hashed. The signature used by OP_CHECKSIG must be a valid
                    signature for this hash and public key. If it is, 1 is
                    returned, 0 otherwise. Afterward, OP_VERIFY is executed.
                  </SSText>
                </SSVStack>
              </SSVStack>
            </SSVStack>
          ))}
        </SSVStack>
        <SSVStack>
          {(tx?.vout || []).map((vout, index) => (
            <SSVStack key={index}>
              <SSSeparator color="gradient" />
              <SSText weight="bold" center>
                Output {index}
              </SSText>
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
      </SSVStack>
    </ScrollView>
  )
}
