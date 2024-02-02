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
  open: boolean;
  wordStart: string;
  onWordSelected: (word: string) => void;
  style: StyleProp<ViewStyle>;
}

export function WordSelector({
  open,
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

  let index = 0;

  const wordListData = getWordList()
    .map(w => ({ index: index++, word: w }))
    .filter(w => w.word.indexOf(wordStart) === 0);

  if (flatList.current?.data?.length > 0 && wordListData.length > 0 && previousWordStart !== wordStart) {
    flatList.current?.scrollToIndex({ index: 0, animated: false });
  }

  if (keyboardOpen && open && wordListData.length > 0) {
    Animated.timing(opacityAnimated, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  } else if (!keyboardOpen || !open) {
    Animated.timing(opacityAnimated, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }

  const separator = () => {
    return <View style={{ height: '100%', backgroundColor: Colors.grey240, width: 1 }} />;
  };

  const handleKeyboardShown = useCallback(() => {
    const metrics = Keyboard.metrics();
    const keyboardHeight = metrics?.height || 0;
    setKeyboardOpen(true);
    setKeyboardHeight(keyboardHeight);
  }, []);

  const handleKeyboardHidden = useCallback(() => {
    const metrics = Keyboard.metrics();
    const keyboardHeight = metrics?.height || 0;
    setKeyboardOpen(false);
    setKeyboardHeight(keyboardHeight);
  }, []);

  useEffect(() => {
    Keyboard.addListener('keyboardDidShow', handleKeyboardShown);
    return () => {
      Keyboard.removeAllListeners('keyboardDidShow');
    };
  }, [handleKeyboardShown]);

  useEffect(() => {
    Keyboard.addListener('keyboardDidHide', handleKeyboardHidden);
    return () => {
      Keyboard.removeAllListeners('keyboardDidHide');
    };
  }, [handleKeyboardHidden]);

  return (
    <Animated.View style={{
      ...style,
      ...styles.container,
      bottom: keyboardHeight,
      width,
      opacity: opacityAnimated,
      display: keyboardOpen && open ? 'flex' : 'none',
    }}>
      <FlatList
        ref={flatList}
        keyboardShouldPersistTaps='handled'
        contentContainerStyle={{
          paddingLeft: 10
        }}
        horizontal={true}
        ItemSeparatorComponent={separator}
        data={wordListData}
        renderItem={({ item, index, separators }) => (
          <TouchableOpacity
            key={item.index}
            onPress={() => onWordSelected(item.word)}
          >
            <View style={{ paddingHorizontal: 20, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ ...Typography.textNormal.x8, color: Colors.black, letterSpacing: 1 }}>{item.word}</Text>
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
  }
});