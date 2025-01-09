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
import { formatDate, formatLabel, formatFiatPrice, formatNumber } from '@/utils/format'
import { useEffect, useState } from 'react'
import { Transaction } from '@/types/models/Transaction'

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

  const placeholder = '-'
  const [tx, setTx] = useState({} as Transaction)
  const [tags, setLocalTags] = useState(getTags())
  const [selectedTags, setSelectedTags] = useState([] as string[])
  const [label, setLabel] = useState('')
  const [originalLabel, setOriginalLabel] = useState('')

  const fetchTxInfo = () => {
    const tx = getTx(accountId, txid)

    if (!tx) return

    setTx(tx)

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

    if (newLabel !== originalLabel)
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
        {tx && (
          <SSVStack gap="none">
            <SSText center>
              {formatNumber(tx.sent || tx.received || 0) + ' sats'}
            </SSText>
            <SSText center>
              {formatFiatPrice(tx.sent || tx.received, btcPrice)}
              {fiatCurrency}
            </SSText>
            <SSText center>
              {formatDate(tx.timestamp)}
            </SSText>
            {tx.prices && (
              <SSText center>
                ({formatFiatPrice(tx.sent || tx.received, tx.prices[fiatCurrency])})
                {fiatCurrency}
              </SSText>
            )}
          </SSVStack>
        )}
        <SSVStack gap="none">
          <SSText>IN BLOCK</SSText>
          <SSText>{tx?.blockHeight || placeholder}</SSText>
        </SSVStack>
        <SSVStack gap="none">
          <SSText>TRANSACTION HASH</SSText>
          <SSText>{txid}</SSText>
        </SSVStack>
        <SSHStack>
          <SSVStack gap="none" style={{ width: '33%' }}>
            <SSText>RAW SIZE</SSText>
            <SSText>{tx?.size || placeholder} </SSText>
          </SSVStack>
          <SSVStack gap="none" style={{ width: '33%' }}>
            <SSText>WEIGHT</SSText>
            <SSText>{tx?.weight || placeholder} </SSText>
          </SSVStack>
          <SSVStack gap="none" style={{ width: '33%' }}>
            <SSText>VIRTUAL SIZE</SSText>
            <SSText>{tx?.vsize || placeholder} </SSText>
          </SSVStack>
        </SSHStack>
        <SSHStack>
          <SSVStack gap="none" style={{ width: '33%' }}>
            <SSText>FEES</SSText>
            <SSText>{tx?.fee || placeholder} </SSText>
          </SSVStack>
          <SSVStack gap="none" style={{ width: '33%' }}>
            <SSText>FEE SAT/B</SSText>
            <SSText>
              {(tx?.fee && tx?.size) ?
                formatNumber(tx.fee/tx.size, 2) + ' sats' :
                placeholder
              }
            </SSText>
          </SSVStack>
          <SSVStack gap="none" style={{ width: '33%' }}>
            <SSText>FEE SAT/VB</SSText>
            <SSText>
              {(tx?.fee && tx?.vsize) ?
                formatNumber(tx.fee/tx.vsize, 2) + ' sats' :
                placeholder
              }
            </SSText>
          </SSVStack>
        </SSHStack>
        <SSVStack gap="none">
          <SSText>TRANSACTION RAW</SSText>
          <SSText>
            {tx?.raw ?
              tx.raw
              .map((x) => x.toString(16).padStart(2, '0'))
              .join(' ') :
              placeholder
            }
          </SSText>
        </SSVStack>
        <SSVStack gap="none">
          <SSText>TRANSACTION VERSION</SSText>
          <SSText>{tx?.version || placeholder}</SSText>
        </SSVStack>
      </SSVStack>
    </ScrollView>
  )
}
