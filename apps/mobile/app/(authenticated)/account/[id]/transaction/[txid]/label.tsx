import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView } from 'react-native'

import SSButton from '@/components/SSButton'
import SSTagInput from '@/components/SSTagInput'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { Account } from '@/types/models/Account'
import { Transaction } from '@/types/models/Transaction'
import { TxSearchParams } from '@/types/navigation/searchParams'
import { formatLabel } from '@/utils/format'

export default function SSTxLabel() {
  const { id: accountId, txid } = useLocalSearchParams<TxSearchParams>()

  const [tx, getTags, setTags, setTxLabel] = useAccountsStore((state) => [
    state.accounts
      .find((account: Account) => account.name === accountId)
      ?.transactions.find((tx: Transaction) => tx.id === txid),
    state.getTags,
    state.setTags,
    state.setTxLabel
  ])

  const [tags, setLocalTags] = useState(getTags())
  const [selectedTags, setSelectedTags] = useState([] as string[])
  const [label, setLabel] = useState('')
  const [originalLabel, setOriginalLabel] = useState('')

  const updateInfo = () => {
    if (!tx) return
    const rawLabel = tx.label || ''
    const { label, tags } = formatLabel(rawLabel)
    setOriginalLabel(rawLabel)
    setLabel(label)
    setSelectedTags(tags)
  }

  useEffect(updateInfo, [tx])

  const saveLabel = () => {
    let newLabel = label.trim()
    setLabel(newLabel)

    if (selectedTags.length > 0) newLabel += ' tags:' + selectedTags.join(',')

    if (newLabel !== originalLabel) {
      setTxLabel(accountId, txid, newLabel)
    }

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
    const selected = selectedTags.filter((t: string) => t !== tag)
    setSelectedTags(selected)
  }

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText>Edit Label</SSText>
        }}
      />
      <SSVStack style={{ padding: 20 }}>
        <SSText center size="lg">
          Edit TX Label
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
        <SSButton
          onPress={saveLabel}
          label={i18n.t('common.save')}
          variant="secondary"
        />
      </SSVStack>
    </ScrollView>
  )
}
