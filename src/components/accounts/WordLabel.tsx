import { View, TextInput, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { AppText } from '../shared/AppText';

import { Typography, Colors } from '../../styles';
import { SeedWordInfo } from './SeedWordInfo';

interface Props {
  style: StyleProp<ViewStyle>;
  seedWord: SeedWordInfo;
  num: number;
};

export function WordLabel({
  style,
  seedWord,
  num,
}: Props) {
  return (
    <View style={style}>
      <TextInput
        style={styles.wordText}
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
  }
});