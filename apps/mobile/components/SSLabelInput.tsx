import SSVStack from '@/layouts/SSVStack'
import SSText from './SSText'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import SSTextInput from './SSTextInput'
import { useEffect, useState } from 'react'
import { formatLabel } from '@/utils/format'
import SSTagInput from './SSTagInput'
import SSButton from './SSButton'

type SSLabelInputProps = {
  label: string
  onUpdateLabel: (label: string) => void
}

export default function SSLabelInput({
  label: originalLabel,
  onUpdateLabel
}: SSLabelInputProps) {
  const [getTags, setTags] = useAccountsStore((state) => [
    state.getTags,
    state.setTags
  ])

  const [selectedTags, setSelectedTags] = useState([] as string[])
  const [tags, setLocalTags] = useState(getTags())
  const [label, setLabel] = useState('')

  const saveLabel = () => {
    let newLabel = label.trim()

    if (selectedTags.length > 0) newLabel += ' tags:' + selectedTags.join(',')

    if (newLabel !== originalLabel) {
      onUpdateLabel(newLabel)
    }
  }

  useEffect(() => {
    const { label, tags } = formatLabel(originalLabel)
    setLabel(label)
    setSelectedTags(tags)
  }, [originalLabel])

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
    <SSVStack style={{ paddingVertical: 20 }}>
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
  )
}
