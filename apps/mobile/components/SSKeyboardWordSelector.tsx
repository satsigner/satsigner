import { FlashList, FlashListRef } from '@shopify/flash-list'
import { useRef } from 'react'
import {
  type StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'

import useKeyboardHeight from '@/hooks/useKeyboardHeight'
import usePrevious from '@/hooks/usePrevious'
import { t } from '@/locales'
import { Colors, Sizes } from '@/styles'
import { getWordList, type WordListName } from '@/utils/bip39'

type WordInfo = {
  index: number
  word: string
}

function wordStartMispells(haystack: string, needle: string) {
  let mismatches = 0
  for (let i = 0; i < needle.length; i += 1) {
    // add a penalty which puts weight on misspells close to the word start
    const penalty = (needle.length - i + 1) / 10
    if (haystack.length <= i || needle[i] !== haystack[i]) {
      mismatches += 1 + penalty
    }
  }
  return mismatches
}

function getMatchingWords(wordStart: string, wordList: string[]): WordInfo[] {
  const maxMisspells = 2
  const result = wordList
    .map((w, index) => ({
      index,
      mispells: wordStartMispells(w, wordStart),
      word: w
    }))
    .filter((w) => w.mispells <= maxMisspells)

  result.sort((a, b) => a.mispells - b.mispells)

  return result.map((w) => ({
    index: w.index,
    word: w.word
  }))
}

type SSKeyboardWordSelectorProps = {
  visible: boolean
  wordStart: string
  wordListName: WordListName
  onWordSelected(word: string): void
  style: StyleProp<ViewStyle>
}

function SSKeyboardWordSelector({
  visible,
  wordStart,
  wordListName,
  onWordSelected,
  style
}: SSKeyboardWordSelectorProps) {
  const wordList = getWordList(wordListName)
  const insets = useSafeAreaInsets()
  const flashList = useRef<FlashListRef<WordInfo> | null>(null)

  const previousWordStart = usePrevious(wordStart)
  const keyboardHeight = useKeyboardHeight()

  const opacityAnimated = useSharedValue(0)

  const data = getMatchingWords(wordStart, wordList)
  const keyboardVisible = keyboardHeight > 0

  if (data.length > 0 && previousWordStart !== wordStart) {
    flashList.current?.scrollToOffset({ animated: false, offset: 0 })
  }

  if (keyboardVisible && visible && data.length > 0) {
    opacityAnimated.set(withTiming(1, { duration: 200 }))
  } else if (!keyboardVisible || !visible) {
    opacityAnimated.set(withTiming(0, { duration: 200 }))
  }

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: opacityAnimated.value,
    zIndex: interpolate(opacityAnimated.value, [0, 0.0001], [0, 1000])
  }))

  // Position from the parent bottom edge. `top` using window height was wrong
  // because absolute layout is relative to the parent (e.g. below the header).
  const bottomOffset = keyboardVisible
    ? Math.max(0, keyboardHeight - insets.bottom) + 10
    : 0

  return (
    <Animated.View
      style={[
        styles.containerBase,
        { bottom: bottomOffset },
        animatedContainerStyle,
        style
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {data.length > 0 ? (
        <FlashList
          ref={flashList}
          data={data}
          horizontal
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              key={item.index}
              onPress={() => onWordSelected(item.word)}
            >
              <View style={styles.wordContainerBase}>
                <Text style={styles.wordText}>{item.word}</Text>
              </View>
            </TouchableOpacity>
          )}
          removeClippedSubviews
        />
      ) : (
        <View style={styles.noMatchingWordsContainerBase}>
          <Text style={styles.wordText}>
            {t('account.import.word.noMatch')}
          </Text>
        </View>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  containerBase: {
    backgroundColor: Colors.white,
    boxShadow: '0 -20px 3.84px rgba(0, 0, 0, 0.25)',
    color: Colors.black,
    height: 50,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 1000
  },
  noMatchingWordsContainerBase: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  },
  separator: {
    backgroundColor: Colors.gray[50],
    height: '100%',
    width: 1
  },
  wordContainerBase: {
    alignItems: 'center',
    borderColor: Colors.gray[100],
    borderRightWidth: 1,
    justifyContent: 'center',
    minWidth: 80,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  wordText: {
    color: Colors.black,
    fontSize: Sizes.text.fontSize.lg
  }
})

export default SSKeyboardWordSelector
