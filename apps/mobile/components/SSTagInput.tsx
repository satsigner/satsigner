import { useRef, useState } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { type TextInput } from 'react-native-gesture-handler'

import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'
import { Colors } from '@/styles'

import { SSIconCircleX } from './icons'
import SSIconButton from './SSIconButton'
import SSText from './SSText'
import SSTextInput from './SSTextInput'

type SSTagInputProps = {
  tags: string[]
  selectedTags: string[]
  onAdd?: (tag: string) => void
  onSelect?: (tags: string[]) => void
  onRemove?: (tag: string) => void
}

function SSTagInput({
  tags,
  selectedTags,
  onAdd,
  onSelect,
  onRemove
}: SSTagInputProps) {
  const [text, setText] = useState('')
  const inputRef = useRef<TextInput>(null)

  function addTag(tag: string) {
    if (tag.length < 1 || selectedTags.includes(tag)) {
      return false
    }

    if (onAdd) {
      onAdd(tag)
    } else if (onSelect) {
      onSelect([...selectedTags, tag])
    }

    return true
  }

  function enterTag() {
    if (addTag(text)) {
      setText('')
    }
  }

  function removeTag(tag: string) {
    if (onRemove) {
      onRemove(tag)
    } else if (onSelect) {
      onSelect(selectedTags.filter((t) => t !== tag))
    }
  }

  function search(a: string, b: string) {
    return a.toLowerCase().includes(b.toLowerCase())
  }

  const suggestedTags = tags.filter(
    (t) => !selectedTags.includes(t) && search(t, text)
  )
  const canCreateTag = text.length > 0 && !tags.includes(text)
  const showSuggestions =
    text.length > 0 && (suggestedTags.length > 0 || canCreateTag)

  return (
    <>
      <SSHStack>
        <View style={{ flexGrow: 1 }}>
          <SSTextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={enterTag}
            blurOnSubmit={false}
            align="left"
            ref={(ref: TextInput | null) => {
              inputRef.current = ref
            }}
          />
        </View>
      </SSHStack>
      {showSuggestions && (
        <SSHStack gap="sm" style={{ flexWrap: 'wrap' }}>
          {suggestedTags.map((tag: string) => (
            <TouchableOpacity
              key={tag}
              activeOpacity={0.6}
              style={styles.button}
              onPress={() => addTag(tag)}
            >
              <SSText>{tag}</SSText>
            </TouchableOpacity>
          ))}
          {canCreateTag && (
            <TouchableOpacity
              activeOpacity={0.6}
              style={styles.button}
              onPress={() => addTag(text)}
            >
              <SSText>{t('common.createTag', { tag: text })}</SSText>
            </TouchableOpacity>
          )}
        </SSHStack>
      )}
      {selectedTags.length > 0 && (
        <SSHStack style={{ flexWrap: 'wrap' }}>
          {selectedTags.map((tag: string) => (
            <SSHStack key={tag} style={styles.tag} gap="sm">
              <SSText>{tag}</SSText>
              <SSIconButton onPress={() => removeTag(tag)}>
                <SSIconCircleX
                  height={20}
                  fill="#bbb"
                  stroke={Colors.gray[850]}
                  width={20}
                />
              </SSIconButton>
            </SSHStack>
          ))}
        </SSHStack>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.gray[800],
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  tag: {
    backgroundColor: Colors.gray[850],
    borderRadius: 3,
    borderStyle: 'solid',
    padding: 5
  }
})

export default SSTagInput
