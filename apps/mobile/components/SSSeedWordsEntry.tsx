import { type ComponentProps, type ReactNode, useState } from 'react'
import { ScrollView, type StyleProp, type ViewStyle } from 'react-native'

import SSKeyboardWordSelector from '@/components/SSKeyboardWordSelector'
import SSSeedWordsInput from '@/components/SSSeedWordsInput'

type SSSeedWordsEntryProps = Omit<
  ComponentProps<typeof SSSeedWordsInput>,
  'onWordSelectorStateChange'
> & {
  children?: ReactNode
  scrollStyle?: StyleProp<ViewStyle>
  contentStyle?: StyleProp<ViewStyle>
}

const INITIAL_WORD_SELECTOR_STATE = {
  onWordSelected: () => {
    // noop
  },
  visible: false,
  wordStart: ''
}

// Scrollable seed words input with the keyboard word-suggestion bar wired up.
// `children` render above the input (e.g. a title and hint).
function SSSeedWordsEntry({
  children,
  scrollStyle,
  contentStyle,
  ...inputProps
}: SSSeedWordsEntryProps) {
  const [wordSelectorState, setWordSelectorState] = useState(
    INITIAL_WORD_SELECTOR_STATE
  )

  return (
    <>
      <ScrollView style={scrollStyle} contentContainerStyle={contentStyle}>
        {children}
        <SSSeedWordsInput
          {...inputProps}
          onWordSelectorStateChange={setWordSelectorState}
        />
      </ScrollView>
      <SSKeyboardWordSelector
        visible={wordSelectorState.visible}
        wordStart={wordSelectorState.wordStart}
        wordListName={inputProps.wordListName}
        onWordSelected={wordSelectorState.onWordSelected}
      />
    </>
  )
}

export default SSSeedWordsEntry
