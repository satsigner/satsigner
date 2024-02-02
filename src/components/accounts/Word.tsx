import { View, TextInput, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { AppText } from '../shared/AppText';

import { Typography, Colors } from '../../styles';
import { SeedWordInfo } from './SeedWordInfo';

type Props = {
  style: StyleProp<ViewStyle>;
  seedWord: SeedWordInfo;
  num: number;
  onChangeWord: (word: string, index: number) => void,
  onEndEditingWord: (word: string, index: number) => void,
  onFocusWord: (word: string, index: number) => void
};

export function Word({
  style,
  seedWord,
  num,
  onChangeWord,
  onEndEditingWord,
  onFocusWord
}: Props) {
  return (
    <View style={style}>
      <TextInput
        style={seedWord?.valid || !seedWord?.dirty ?
          styles.wordText :
          [styles.wordText, styles.wordTextInvalid]}
        onChangeText={(word) => onChangeWord(word, num - 1)}
        onEndEditing={(event) => onEndEditingWord(event.nativeEvent.text, num - 1)}
        onFocus={(event) => onFocusWord(event.nativeEvent.text, num - 1)}
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect={false}
        spellCheck={false}
        value={seedWord?.word}
      ></TextInput>
      <AppText style={styles.wordNumLabel}>{num}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wordNumLabel: {
    position: 'absolute',
    top: 5,
    left: 5,
    ...Typography.textNormal.x4,
    lineHeight: Typography.fontSize.x4.fontSize
  },
  wordText: {
    ...Typography.textHighlight.x9,
    backgroundColor: Colors.inputBackground,
    fontWeight: '300',
    textAlign: 'center',
    borderRadius: 3,
    letterSpacing: 0.6,
    flex: 1
  },
  wordTextInvalid: {
    borderWidth: 2,
    borderColor: Colors.invalid
  }
});