import { useRef, useState } from 'react'
import SSTextInput from './SSTextInput'
import SSHStack from '@/layouts/SSHStack'
import { SSIconCircleX } from './icons'
import SSIconButton from './SSIconButton'
import SSText from './SSText'
import { ScrollView, View } from 'react-native'
import SSButton from './SSButton'
import { TextInput } from 'react-native-gesture-handler'
import { Stack } from 'expo-router'
import { Colors } from '@/styles'

type Props = {
  tags: string[]
  selectedTags: string[]
  onSelect: (tag: string[]) => void
}

export default function SSTagInput(props: Props) {
  const { tags, selectedTags, onSelect } = props
  const [text, setText] = useState('')
  const [inputFocused, setInputFocused] = useState(false)
  const inputRef = useRef<TextInput>()

  const enterTag = () => {
    if (addTag(text)) {
      setText('')
    }
    // inputRef.current.focus()
  }

  const addTag = (tag: string) => {
    if (tag.length<2 || selectedTags.includes(tag))
      return false
    onSelect([...selectedTags, tag])
    return true
  }

  const removeTag = (tag: string) => {
    onSelect(selectedTags.filter((t) => t !== tag))
  }

  const search = (a: string, b: string) =>
    a.toLowerCase().includes(b.toLowerCase())

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>
            EXTRA SECURITY 🧐
          </SSText>
        }}
      />

      <SSHStack>
        <View style={{ flexGrow: 1 }}>
          <SSTextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={enterTag}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            blurOnSubmit={false}
            placeholder='Type a tag'
            align="left"
            size="small"
            ref={(ref: TextInput) => inputRef.current = ref}
          />
        </View>
      </SSHStack>
      {((inputFocused && text.length > 1) || text.length > 0) &&
      <ScrollView>
        <SSHStack gap="sm" style={{ flexWrap: 'wrap' }}>
          {tags
              .filter((t) => !selectedTags.includes(t) && search(t, text))
              .map((tag: string) => (
                <SSButton
                  label={tag}
                  key={tag}
                  style={{
                    borderRadius: 5,
                    paddingHorizontal: 8,
                    backgroundColor: Colors.gray[800],
                    height: 'auto',
                    width: 'auto'
                  }}
                  onPress={() => addTag(tag)}
                />
              ))
          }
        </SSHStack>
      </ScrollView>
      }
      <SSHStack style={{ flexWrap: 'wrap' }}>
        {selectedTags.map((tag: string) => (
          <SSHStack
            key={tag}
            style={{
              backgroundColor: Colors.gray[850],
              borderRadius: 3,
              borderStyle: 'solid',
              padding: 5
            }}
            gap="sm"
          >
            <SSText uppercase>
              {tag}
            </SSText>
            <SSIconButton
              onPress={() => removeTag(tag)}
            >
              <SSIconCircleX
                height={20}
                fill='#bbb'
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
