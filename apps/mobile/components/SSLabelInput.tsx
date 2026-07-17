import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import useKeyboardHeight from '@/hooks/useKeyboardHeight'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { Sizes } from '@/styles'
import { getLabelTextSize } from '@/utils/label'
import { parseLabel, parseLabelTags } from '@/utils/parse'

import SSButton from './SSButton'
import SSTagInput, { type SSTagInputHandle } from './SSTagInput'
import SSText from './SSText'
import SSTextInput from './SSTextInput'

const LABEL_INPUT_MIN_HEIGHT = Sizes.textInput.height.default * 3

type SSLabelInputProps = {
  label: string
  onUpdateLabel: (label: string) => void
}

function stripLineBreaks(text: string) {
  return text.replace(/[\r\n]+/g, '')
}

function cancelLabelChanges() {
  router.back()
}

function SSLabelInput({
  label: originalLabel,
  onUpdateLabel
}: SSLabelInputProps) {
  const [getTags, setTags] = useAccountsStore(
    useShallow((state) => [state.getTags, state.setTags])
  )
  const keyboardHeight = useKeyboardHeight()
  const tagInputRef = useRef<SSTagInputHandle>(null)

  const [selectedTags, setSelectedTags] = useState([] as string[])
  const [tags, setLocalTags] = useState(() => getTags())
  const [label, setLabel] = useState('')
  const labelFontSize = Sizes.text.fontSize[getLabelTextSize(label)]

  function saveLabel() {
    const newLabel = parseLabelTags(label, selectedTags)
    if (newLabel !== originalLabel) {
      onUpdateLabel(newLabel)
      return
    }
    router.back()
  }

  useEffect(() => {
    const { label, tags } = parseLabel(originalLabel)
    setLabel(stripLineBreaks(label))
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

  function handleLabelSubmit() {
    handleInputEnded()
    tagInputRef.current?.focus()
  }

  return (
    <SSVStack style={styles.container} gap="sm">
      <SSText uppercase>{t('common.label')}</SSText>
      <SSTextInput
        align="left"
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        // Multiline defaults blurOnSubmit=false (inserts newline). Force submit
        // so Return moves focus to tags; line breaks are also stripped on change.
        blurOnSubmit
        returnKeyType="next"
        value={label}
        onChangeText={(text) => setLabel(stripLineBreaks(text))}
        onBlur={handleInputEnded}
        onSubmitEditing={handleLabelSubmit}
        style={[styles.labelInput, { fontSize: labelFontSize }]}
      />
      <SSText uppercase>{t('common.tags')}</SSText>
      <SSTagInput
        ref={tagInputRef}
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
      <SSButton
        onPress={cancelLabelChanges}
        label={t('common.cancel')}
        variant="ghost"
      />
      {keyboardHeight > 0 ? <View style={{ height: keyboardHeight }} /> : null}
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20
  },
  labelInput: {
    fontWeight: '300',
    height: LABEL_INPUT_MIN_HEIGHT,
    paddingVertical: 12
  }
})

export default SSLabelInput
