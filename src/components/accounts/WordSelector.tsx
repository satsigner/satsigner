import { useRef, useEffect, useState, useCallback } from 'react';
import {
  Animated,
  View,
  Text,
  FlatList,
  useWindowDimensions,
  Keyboard,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle
} from 'react-native';

import { Typography, Colors } from '../../styles';

import usePrevious from '../shared/usePrevious';
import getWordList from '../shared/getWordList';

interface Props {
  show: boolean;
  wordStart: string;
  onWordSelected: (word: string) => void;
  style: StyleProp<ViewStyle>;
}

interface WordInfo {
  index: number;
  word: string;
}

function getMatchingWords(wordStart: string): WordInfo[] {
  let index = 0;

  return getWordList()
    .map(w => ({ index: index++, word: w }))
    .filter(w => w.word.indexOf(wordStart) === 0);
}

// Component behavior:
// * when multiple characters are entered in a word, show the word selector
// * word selector should not block the text input you are entering into
// * when chaning text input content, word selector should scroll back to start of the updated list
// * upon selecting an item in the word selector, it should disappear
// * selector should have fade in animation when it is displayed
// * selector should have fade out animation when it is hidden
// * when selector is hidden, taps where it was being displayed should be received by the controls (e.g. text inputs)

export function WordSelector({
  show,
  wordStart,
  onWordSelected,
  style
}: Props) {
  const { width } = useWindowDimensions();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const flatList = useRef<FlatList>(null);

  const previousWordStart = usePrevious(wordStart);

  const opacityAnimated = useRef(new Animated.Value(0)).current;

  const data = getMatchingWords(wordStart);

  // if there is data, return scroll location of list to start
  if (data.length > 0 && previousWordStart !== wordStart) {
    flatList.current?.scrollToOffset({ animated: false, offset: 0 });
  }

  if (keyboardOpen && show && data.length > 0) {
    // opening, fade the list in
    Animated.timing(opacityAnimated, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  } else if (! keyboardOpen || ! show) {
    // if closing, fade the list out
    Animated.timing(opacityAnimated, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }

  const separator = () => {
    return <View style={styles.listItemSeparator} />;
  };

  // when keyboard is shown store that its open and its height
  const handleKeyboardShown = useCallback(() => {
    const metrics = Keyboard.metrics();
    const keyboardHeight = metrics?.height || 0;
    setKeyboardOpen(true);
    setKeyboardHeight(keyboardHeight);
  }, []);
  useEffect(() => {
    Keyboard.addListener('keyboardDidShow', handleKeyboardShown);
  }, [handleKeyboardShown]);

  // when keyboard is hidden, store that it is not open
  const handleKeyboardHidden = useCallback(() => {
    setKeyboardOpen(false);
  }, []);
  useEffect(() => {
    Keyboard.addListener('keyboardDidHide', handleKeyboardHidden);
  }, [handleKeyboardHidden]);

  return (
    <Animated.View style={{
      ...style,
      ...styles.container,
      bottom: keyboardHeight,
      width,
      opacity: opacityAnimated,
      // set z-index to 0 when hidden so text inputs behind receive focus
      // but only after opacity animation completes
      zIndex: opacityAnimated.interpolate({
        inputRange: [0, 0.0001],
        outputRange: [0, 1]
      })
    }}>
      <FlatList
        ref={flatList}
        keyboardShouldPersistTaps='handled'
        contentContainerStyle={styles.list}
        horizontal={true}
        ItemSeparatorComponent={separator}
        data={data}
        renderItem={({ item, index, separators }) => (
          <TouchableOpacity
            key={item.index}
            onPress={() => onWordSelected(item.word)}
          >
            <View style={styles.listItem}>
              <Text style={styles.listItemText}>{item.word}</Text>
            </View>
          </TouchableOpacity>
        )} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({  
  container: {
    position: 'absolute',
    backgroundColor: Colors.white,
    color: Colors.black,
    zIndex: 1
  },
  list: {
    paddingLeft: 10
  },
  listItem: {
    paddingHorizontal: 20,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center'
  },
  listItemText: {
    ...Typography.textNormal.x8,
    color: Colors.black,
    letterSpacing: 1
  },
  listItemSeparator: {
    height: '100%',
    backgroundColor: Colors.grey240,
    width: 1
  }
});