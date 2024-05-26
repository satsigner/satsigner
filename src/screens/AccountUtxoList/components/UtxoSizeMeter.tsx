import { DimensionValue, StyleSheet, View } from "react-native";
import { Colors } from "../../../styles";

import { scaleLinear } from "d3";

interface Props {
  size: number;
  largestSize: number;
  selected: boolean;
}

export function UtxoSizeMeter({
  size,
  largestSize,
  selected
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
      <View style={styles.backgroundBar}></View>
      <View style={[
        styles.sizeBar,
        selected ? styles.selectedSizeBar : {},
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
  backgroundBar: {
    backgroundColor: Colors.grey42,
    height: 2
  },
  sizeBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: Colors.white,
    opacity: 0.3,
    height: 2
  },
  selectedSizeBar: {
    top: -2,
    opacity: 1,
    borderRadius: 1,
    height: 6
  }
});
