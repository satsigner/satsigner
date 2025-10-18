import { FlashList } from '@shopify/flash-list'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Keyboard,
  type StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type ViewStyle
} from 'react-native'

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
    if (haystack.length <= i || needle[i] !== haystack[i])
      mismatches += 1 + penalty
  }
  return mismatches
}

function getMatchingWords(wordStart: string, wordList: string[]): WordInfo[] {
  const maxMisspells = 2
  let index = 0

  const result = wordList
    .map((w) => ({
      index: index++,
      word: w,
      mispells: wordStartMispells(w, wordStart)
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
  const { width, height } = useWindowDimensions()
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const flashList = useRef<FlashList<WordInfo>>(null)

  const previousWordStart = usePrevious(wordStart)
  const keyboardHeight = useKeyboardHeight()

  const opacityAnimated = useRef(new Animated.Value(0)).current

  const data = getMatchingWords(wordStart, wordList)

  if (data.length > 0 && previousWordStart !== wordStart) {
    flashList.current?.scrollToOffset({ animated: false, offset: 0 })
  }

  if (keyboardOpen && visible && data.length > 0) {
    Animated.timing(opacityAnimated, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true
    }).start()
  } else if (!keyboardOpen || !visible) {
    Animated.timing(opacityAnimated, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true
    }).start()
  }

  const handleKeyboardShown = useCallback(() => {
    setKeyboardOpen(true)
  }, [])

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      'keyboardDidShow',
      handleKeyboardShown
    )
    return () => showSubscription?.remove()
  }, [handleKeyboardShown])

  const handleKeyboardHidden = useCallback(() => {
    setKeyboardOpen(false)
  }, [])

  useEffect(() => {
    const hideSubscription = Keyboard.addListener(
      'keyboardDidHide',
      handleKeyboardHidden
    )
    return () => hideSubscription?.remove()
  }, [handleKeyboardHidden])

  const containerStyle = useMemo(() => {
    let topValue = height
    // Position directly above keyboard for both iOS and Android
    if (keyboardHeight > 0) {
      topValue = height - keyboardHeight - 50
    }

    return StyleSheet.compose(
      {
        ...styles.containerBase,
        width, // Use actual screen width
        top: topValue - 55, // Subtract the height of the word selector container
        bottom: undefined, // Remove bottom positioning
        opacity: opacityAnimated,
        zIndex: opacityAnimated.interpolate({
          inputRange: [0, 0.0001],
          outputRange: [0, 1000]
        }) as unknown as number
      },
      style
    )
  }, [width, height, opacityAnimated, keyboardHeight, style])

  return (
    <Animated.View
      style={containerStyle}
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
          estimatedItemSize={150}
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
    position: 'absolute',
    backgroundColor: Colors.white,
    color: Colors.black,
    zIndex: 1000,
    left: 0,
    right: 0,
    top: undefined,
    height: 50,
    width: Dimensions.get('window').width,
    elevation: 1000, // For Android
    shadowColor: '#000', // For iOS
    shadowOffset: {
      width: 0,
      height: -20
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84
  },
  noMatchingWordsContainerBase: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  wordContainerBase: {
    paddingHorizontal: 16,
    paddingVertical: 12,

    borderRightWidth: 1,
    borderColor: Colors.gray[100],
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center'
  },
  wordText: {
    fontSize: Sizes.text.fontSize.lg,
    color: Colors.black
  },
  separator: {
    height: '100%',
    backgroundColor: Colors.gray[50],
    width: 1
  }
})

export default SSKeyboardWordSelector
