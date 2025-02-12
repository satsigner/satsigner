import { useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { type TextInput } from 'react-native-gesture-handler'

import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'
import { Colors } from '@/styles'

import { SSIconCircleX } from './icons'
import SSButton from './SSButton'
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
  const [inputFocused, setInputFocused] = useState(false)
  const inputRef = useRef<TextInput>()

  function addTag(tag: string) {
    if (tag.length < 2 || selectedTags.includes(tag)) return false

    if (onAdd) onAdd(tag)
    else if (onSelect) onSelect([...selectedTags, tag])

    return true
  }

  function enterTag() {
    if (addTag(text)) setText('')
  }

  function removeTag(tag: string) {
    if (onRemove) onRemove(tag)
    else if (onSelect) onSelect(selectedTags.filter((t) => t !== tag))
  }

  function search(a: string, b: string) {
    return a.toLowerCase().includes(b.toLowerCase())
  }

  return (
    <>
      <SSHStack>
        <View style={{ flexGrow: 1 }}>
          <SSTextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={enterTag}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            blurOnSubmit={false}
            placeholder={t('common.addTag')}
            align="left"
            size="small"
            ref={(ref: TextInput) => (inputRef.current = ref)}
          />
        </View>
      </SSHStack>
      {((inputFocused && text.length > 1) || text.length > 0) && (
        <ScrollView>
          <SSHStack gap="sm" style={{ flexWrap: 'wrap' }}>
            {tags
              .filter((t) => !selectedTags.includes(t) && search(t, text))
              .map((tag: string) => (
                <SSButton
                  key={tag}
                  label={tag}
                  style={styles['button']}
                  onPress={() => addTag(tag)}
                  uppercase={false}
                />
              ))}
            {text.length > 1 && !tags.includes(text) && (
              <SSButton
                label={t('common.createTag', { tag: text })}
                style={styles['button']}
                onPress={() => addTag(text)}
                uppercase={false}
              />
            )}
          </SSHStack>
        </ScrollView>
      )}
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
    </>
  )
}

const styles = StyleSheet.create({
  tag: {
    backgroundColor: Colors.gray[850],
    borderRadius: 3,
    borderStyle: 'solid',
    padding: 5
  },
  button: {
    borderRadius: 5,
    paddingHorizontal: 8,
    backgroundColor: Colors.gray[800],
    height: 'auto',
    width: 'auto'
  }
})

export default SSTagInput
