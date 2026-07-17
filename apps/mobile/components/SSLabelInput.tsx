import { useEffect, useState } from 'react'
import { StyleSheet } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { Sizes } from '@/styles'
import { getLabelTextSize } from '@/utils/label'
import { parseLabel, parseLabelTags } from '@/utils/parse'

import SSButton from './SSButton'
import SSTagInput from './SSTagInput'
import SSText from './SSText'
import SSTextInput from './SSTextInput'

const LABEL_INPUT_MIN_HEIGHT = Sizes.textInput.height.default * 3

type SSLabelInputProps = {
  label: string
  onUpdateLabel: (label: string) => void
}

function SSLabelInput({
  label: originalLabel,
  onUpdateLabel
}: SSLabelInputProps) {
  const [getTags, setTags] = useAccountsStore(
    useShallow((state) => [state.getTags, state.setTags])
  )

  const [selectedTags, setSelectedTags] = useState([] as string[])
  const [tags, setLocalTags] = useState(() => getTags())
  const [label, setLabel] = useState('')
  const labelFontSize = Sizes.text.fontSize[getLabelTextSize(label)]

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
    const matches = label.match(/#\w+/g)

    if (!matches) {
      return
    }

    const newTags = [] as string[]
    const newSelectedTags = [] as string[]

    for (const tag of matches.map((match) => match.replace('#', ''))) {
      if (!tags.includes(tag)) {
        newTags.push(tag)
      }
      if (!selectedTags.includes(tag)) {
        newSelectedTags.push(tag)
      }
    }

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
    <SSVStack style={styles.container} gap="sm">
      <SSText uppercase>{t('common.label')}</SSText>
      <SSTextInput
        align="left"
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        value={label}
        onChangeText={setLabel}
        onBlur={handleInputEnded}
        style={[styles.labelInput, { fontSize: labelFontSize }]}
      />
      <SSText uppercase>{t('common.tags')}</SSText>
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

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20
  },
  labelInput: {
    height: LABEL_INPUT_MIN_HEIGHT,
    paddingVertical: 12
  }
})

export default SSLabelInput
