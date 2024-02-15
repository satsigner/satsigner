import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
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
    <View style={[style, styles.container]}>
      <AppText
        style={styles.wordText}
      >{seedWord?.word}</AppText>
      <AppText style={styles.wordNumLabel}>{num}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordNumLabel: {
    position: 'absolute',
    top: 5,
    left: 5,
    ...Typography.textNormal.x4,
    lineHeight: Typography.fontSize.x4.fontSize
  },
  wordText: {
    ...Typography.textHighlight.x9,
    fontWeight: '300',
    letterSpacing: 0.6,
  }
});