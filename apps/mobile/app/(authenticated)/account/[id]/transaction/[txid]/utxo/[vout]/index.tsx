import { Stack, useLocalSearchParams } from 'expo-router'
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
import { formatDate, parseLabel } from '@/utils/format'

export default function UtxoDetails() {
  const { id: accountId, txid, vout } = useLocalSearchParams<UtxoSearchParams>()

  const [getCurrentAccount, getTags, setTags, getTx, getUtxo, setUtxoLabel] =
    useAccountsStore((state) => [
      state.getCurrentAccount,
      state.getTags,
      state.setTags,
      state.getTx,
      state.getUtxo,
      state.setUtxoLabel
    ])

  const placeholder = '-'
  const account = getCurrentAccount(accountId)!
  const [tags, setLocalTags] = useState(getTags())
  const [selectedTags, setSelectedTags] = useState([] as string[])
  const [blockTime, setBlockTime] = useState(placeholder)
  const [blockHeight, setBlockHeight] = useState(placeholder)
  const [txSize, setTxSize] = useState(placeholder)
  const [utxoAddress, setUtxoAddress] = useState(placeholder)
  const [label, setLabel] = useState('')

  useEffect(() => {
    const fetchUtxoInfo = async () => {
      const tx = await getTx(accountId, txid)
      const utxo = await getUtxo(accountId, txid, Number(vout))
      if (tx.blockHeight) setBlockHeight(tx.blockHeight.toString())
      if (tx.size) setTxSize(tx.size.toString())
      if (tx.timestamp) setBlockTime(formatDate(tx.timestamp))
      if (utxo.addressTo) setUtxoAddress(utxo.addressTo)
      if (utxo.label) {
        const parsedLabel = parseLabel(utxo.label)
        setLabel(parsedLabel.label)
        setSelectedTags(parsedLabel.tags)
      }
    }

    try {
      fetchUtxoInfo()
    } catch {
      // TODO: show error notification via snack bar
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txid])

  const updateLabel = (label: string, tags: string[]) => {
    label = label.trim()
    if (tags.length > 0) {
      label += ' tags:' + tags.join(',')
    }
    setUtxoLabel(accountId, txid, Number(vout), label)
  }

  const onAddTag = (tag: string) => {
    if (!tags.includes(tag)) {
      const allTags = [...tags, tag]
      setTags(allTags)
      setLocalTags(allTags)
    }
    const selected = [...selectedTags, tag]
    setSelectedTags(selected)
    updateLabel(label, selected)
  }

  const onDelTag = (tag: string) => {
    // TODO: update cached tags
    const selected = selectedTags.filter((t) => t !== tag)
    setSelectedTags(selected)
    updateLabel(label, selected)
  }

  const handleLabelChange = (newLabel: string) => {
    setLabel(newLabel)
    updateLabel(newLabel, selectedTags)
  }

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{account.name}</SSText>
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
            onChangeText={handleLabelChange}
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
              <SSClipboardCopy text={txSize}>
                <SSText color="muted" uppercase>
                  {txSize}{' '}
                  {txSize !== placeholder ? i18n.t('common.bytes') : ''}
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
          <SSClipboardCopy text={txid}>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {i18n.t('common.transaction')}
              </SSText>
              <SSText color="muted">{txid}</SSText>
            </SSVStack>
          </SSClipboardCopy>
          <SSSeparator color="gradient" />
          <SSClipboardCopy text={vout}>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {i18n.t('common.outputIndex')}
              </SSText>
              <SSText color="muted">{vout}</SSText>
            </SSVStack>
          </SSClipboardCopy>
        </SSVStack>
        <SSButton label={i18n.t('common.save')} variant="secondary" />
      </SSVStack>
    </ScrollView>
  )
}
