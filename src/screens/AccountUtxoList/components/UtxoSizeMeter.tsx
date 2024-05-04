import { DimensionValue, StyleSheet, View } from "react-native";
import { Colors } from "../../../styles";

interface Props {
  size: number;
  totalSize: number;
}

export function UtxoSizeMeter({
  size,
  totalSize
}: Props) {
  const percentage = Math.round(size / totalSize * 100) || '0.5';
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
