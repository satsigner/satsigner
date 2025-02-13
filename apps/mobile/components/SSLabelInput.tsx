import { useEffect, useState } from 'react'

import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { parseLabel, parseLabelTags } from '@/utils/parse'

import SSButton from './SSButton'
import SSTagInput from './SSTagInput'
import SSText from './SSText'
import SSTextInput from './SSTextInput'

type SSLabelInputProps = {
  label: string
  onUpdateLabel: (label: string) => void
}

function SSLabelInput({
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

  function saveLabel() {
    const newLabel = parseLabelTags(label, selectedTags)
    if (newLabel !== originalLabel) {
      onUpdateLabel(newLabel)
    }
  }

  useEffect(() => {
    const { label, tags } = parseLabel(originalLabel)
    setLabel(label)
    setSelectedTags(tags)
  }, [originalLabel])

  function onAddTag(tag: string) {
    if (!tags.includes(tag)) {
      const allTags = [...tags, tag]
      setTags(allTags)
      setLocalTags(allTags)
    }
    const selected = [...selectedTags, tag]
    setSelectedTags(selected)
  }

  function onDelTag(tag: string) {
    const selected = selectedTags.filter((t: string) => t !== tag)
    setSelectedTags(selected)
  }

  function handleInputEnded() {
    const matches = label.match(/#\w[\w\d]+/g)

    if (!matches) {
      return
    }

    const newTags = [] as string[]
    const newSelectedTags = [] as string[]

    matches
      .map((match) => match.replace('#', ''))
      .forEach((tag: string) => {
        if (!tags.includes(tag)) newTags.push(tag)
        if (!selectedTags.includes(tag)) newSelectedTags.push(tag)
      })

    if (newTags.length > 0) {
      const allTags = [...tags, ...newTags]
      setTags(allTags)
      setLocalTags(allTags)
    }

    if (newSelectedTags.length > 0) {
      setSelectedTags([...selectedTags, ...newSelectedTags])
    }

    setLabel(label.replace(/#.*/, '').trim())
  }

  return (
    <SSVStack style={{ paddingVertical: 20 }}>
      <SSText weight="bold" uppercase>
        {t('common.label')}
      </SSText>
      <SSTextInput
        align="left"
        multiline
        numberOfLines={3}
        blurOnSubmit
        style={{
          height: 'auto',
          textAlignVertical: 'top',
          padding: 10
        }}
        value={label}
        onChangeText={setLabel}
        onBlur={handleInputEnded}
        onSubmitEditing={handleInputEnded}
      />
      <SSText weight="bold" uppercase>
        {t('common.tags')}
      </SSText>
      <SSTagInput
        tags={tags}
        selectedTags={selectedTags}
        onAdd={onAddTag}
        onRemove={onDelTag}
      />
      <SSButton
        onPress={saveLabel}
        label={t('common.save')}
        variant="secondary"
      />
    </SSVStack>
  )
}

export default SSLabelInput
