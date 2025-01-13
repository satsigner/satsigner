import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
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
import type { UtxoSearchParams } from '@/types/navigation/searchParams'
import { formatDate, formatLabel, formatNumber } from '@/utils/format'

export default function UtxoDetails() {
  const { id: accountId, txid, vout } = useLocalSearchParams<UtxoSearchParams>()

  const [getTags, setTags, tx, utxo, setUtxoLabel] = useAccountsStore(
    (state) => [
      state.getTags,
      state.setTags,
      state.accounts
        .find((account) => account.name === accountId)
        ?.transactions.find((tx) => tx.id === txid),
      state.accounts
        .find((account) => account.name === accountId)
        ?.utxos.find((u) => u.txid === txid && u.vout === Number(vout)),
      state.setUtxoLabel
    ]
  )

  const placeholder = '-'
  const [tags, setLocalTags] = useState(getTags())
  const [selectedTags, setSelectedTags] = useState([] as string[])
  const [blockTime, setBlockTime] = useState(placeholder)
  const [blockHeight, setBlockHeight] = useState(placeholder)
  const [amount, setAmount] = useState(placeholder)
  const [utxoAddress, setUtxoAddress] = useState(placeholder)
  const [label, setLabel] = useState('')
  const [originalLabel, setOriginalLabel] = useState('')

  const updateInfo = () => {
    if (tx) {
      const { blockHeight, timestamp } = tx
      if (blockHeight) setBlockHeight(blockHeight.toString())
      if (timestamp) setBlockTime(formatDate(timestamp))
    }

    if (utxo) {
      const { addressTo, value } = utxo
      const rawLabel = utxo.label || ''
      const { label, tags } = formatLabel(rawLabel)
      if (value) setAmount(formatNumber(value))
      if (addressTo) setUtxoAddress(addressTo)
      setOriginalLabel(rawLabel)
      setLabel(label)
      setSelectedTags(tags)
    }
  }

  useEffect(() => {
    try {
      updateInfo()
    } catch {
      router.back()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx, utxo])

  const saveLabel = () => {
    let newLabel = label.trim()
    setLabel(newLabel)

    if (selectedTags.length > 0) newLabel += ' tags:' + selectedTags.join(',')

    if (newLabel !== originalLabel)
      setUtxoLabel(accountId!, txid!, Number(vout), newLabel)

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

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{accountId}</SSText>
        }}
      />
      <SSVStack
        gap="xl"
        style={{
          flexGrow: 1,
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 20
        }}
      >
        <SSVStack>
          <SSText center size="lg">
            {i18n.t('utxoDetails.title')}
          </SSText>
          <SSText weight="bold" uppercase>
            {i18n.t('common.label')}
          </SSText>
          <SSTextInput
            align="left"
            multiline
            numberOfLines={3}
            style={{
              height: 'auto',
              textAlignVertical: 'top',
              padding: 10
            }}
            value={label}
            onChangeText={setLabel}
          />
          <SSText weight="bold" uppercase>
            {i18n.t('common.tags')}
          </SSText>
          <SSTagInput
            tags={tags}
            selectedTags={selectedTags}
            onAdd={onAddTag}
            onRemove={onDelTag}
          />
        </SSVStack>
        <SSVStack>
          <SSSeparator color="gradient" />
          <SSHStack justifyBetween>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {i18n.t('common.date')}
              </SSText>
              <SSText color="muted" uppercase>
                {blockTime}
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {i18n.t('common.block')}
              </SSText>
              <SSText color="muted" uppercase>
                {blockHeight}
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {i18n.t('common.amount')}
              </SSText>
              <SSClipboardCopy text={amount}>
                <SSText color="muted" uppercase>
                  {amount}{' '}
                  {amount !== placeholder ? i18n.t('bitcoin.sats') : ''}
                </SSText>
              </SSClipboardCopy>
            </SSVStack>
          </SSHStack>
          <SSSeparator color="gradient" />
          <SSClipboardCopy text={utxoAddress}>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {i18n.t('common.address')}
              </SSText>
              <SSText color="muted">{utxoAddress}</SSText>
            </SSVStack>
          </SSClipboardCopy>
          <SSSeparator color="gradient" />
          <SSClipboardCopy text={txid || ''}>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {i18n.t('common.transaction')}
              </SSText>
              <SSText color="muted">{txid}</SSText>
            </SSVStack>
          </SSClipboardCopy>
          <SSSeparator color="gradient" />
          <SSClipboardCopy text={vout || ''}>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {i18n.t('common.outputIndex')}
              </SSText>
              <SSText color="muted">{vout}</SSText>
            </SSVStack>
          </SSClipboardCopy>
        </SSVStack>
        <SSButton
          onPress={saveLabel}
          label={i18n.t('common.save')}
          variant="secondary"
        />
      </SSVStack>
    </ScrollView>
  )
}
