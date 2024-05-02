import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  FlatList,
  Keyboard,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  ViewStyle
} from 'react-native'

import { getWordList } from '@/api/bip39'
import { Colors, Sizes } from '@/styles'
import usePrevious from '@/utils/hooks/usePrevious'

type WordInfo = {
  index: number
  word: string
}

function getMatchingWords(wordStart: string): WordInfo[] {
  let index = 0

  return getWordList()
    .map((w) => ({ index: index++, word: w }))
    .filter((w) => w.word.indexOf(wordStart) === 0)
}

type SSKeyboardWordSelectorProps = {
  visible: boolean
  wordStart: string
  onWordSelected(word: string): void
  style: StyleProp<ViewStyle>
}

export default function SSKeyboardWordSelector({
  visible,
  wordStart,
  onWordSelected,
  style
}: SSKeyboardWordSelectorProps) {
  const { width } = useWindowDimensions()
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const flatList = useRef<FlatList>(null)

  const previousWordStart = usePrevious(wordStart)

  const opacityAnimated = useRef(new Animated.Value(0)).current

  const data = getMatchingWords(wordStart)

  if (data.length > 0 && previousWordStart !== wordStart) {
    flatList.current?.scrollToOffset({ animated: false, offset: 0 })
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
    Keyboard.addListener('keyboardDidShow', handleKeyboardShown)
  }, [handleKeyboardShown])

  const handleKeyboardHidden = useCallback(() => {
    setKeyboardOpen(false)
  }, [])

  useEffect(() => {
    Keyboard.addListener('keyboardDidHide', handleKeyboardHidden)
  }, [handleKeyboardHidden])

  const containerStyle = useMemo(() => {
    return StyleSheet.compose(
      {
        ...styles.containerBase,
        width,
        opacity: opacityAnimated,
        zIndex: opacityAnimated.interpolate({
          inputRange: [0, 0.0001],
          outputRange: [0, 1]
        }) as unknown as number
      },
      style
    )
  }, [width, opacityAnimated, style])

  return (
    <Animated.View style={containerStyle}>
      <FlatList
        ref={flatList}
        data={data}
        keyboardShouldPersistTaps="handled"
        horizontal
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  containerBase: {
    position: 'absolute',
    bottom: 0,
    backgroundColor: Colors.white,
    color: Colors.black,
    zIndex: 1
  },
  wordContainerBase: {
    paddingHorizontal: 20,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
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
