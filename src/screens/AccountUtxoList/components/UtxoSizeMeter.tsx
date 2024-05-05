import { DimensionValue, StyleSheet, View } from "react-native";
import { Colors } from "../../../styles";

import { scaleLinear } from "d3";

interface Props {
  size: number;
  largestSize: number;
}

export function UtxoSizeMeter({
  size,
  largestSize
}: Props) {
  // collapse the range of values for display so small and medium
  // UTXO sizes don't look so tiny compared to larger values
  const root = 2;
  const expSize = Math.pow(size, 1/root);
  const largestExpSize = Math.pow(largestSize, 1/root);

  const minDisplayPercentage = 1;
  const maxDisplayPercentage = 82;
  const scale = scaleLinear(
    [0, 100],
    [minDisplayPercentage, maxDisplayPercentage]
  ).clamp(true);

  const percentage = scale(Math.round(expSize / largestExpSize * 100));
  const percentageText = percentage + '%' as DimensionValue;

  return (
    <View style={styles.container}>
      <View style={styles.backBar}></View>
      <View style={[
        styles.frontBar,
        { width: percentageText }
      ]}></View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    height: 2
  },
  backBar: {
    backgroundColor: Colors.grey42,
    height: 2
  },
  frontBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: Colors.white,
    opacity: 0.3,
    height: 2,
    width: '50%'
  }
});
