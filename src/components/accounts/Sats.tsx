import { StyleProp, StyleSheet, TextStyle, View, ViewStyle } from "react-native";

import { AppText } from "../shared/AppText";
import formatNumber from "../../utils/formatNumber";
import satsToUsd from "../shared/satsToUsd";
import { Colors, Typography } from "../../styles";

interface Props {
  sats: number;
  currencyStyle?: StyleProp<ViewStyle | TextStyle>;
  satsStyle?: StyleProp<ViewStyle | TextStyle>;
  satsLabelStyle?: StyleProp<ViewStyle | TextStyle>;
  usdStyle?: StyleProp<ViewStyle | TextStyle>;
  usdLabelStyle?: StyleProp<ViewStyle | TextStyle>;
};

export function Sats({
  sats,
  currencyStyle,
  satsStyle,
  satsLabelStyle,
  usdStyle,
  usdLabelStyle
}: Props) {
  return (
    <>
      <View style={[styles.currency, currencyStyle]}>
        <AppText style={[styles.sats, satsStyle]}>{formatNumber(sats)}</AppText>
        <AppText style={[styles.satsLabel, satsLabelStyle]}>sats</AppText>
      </View>
      <View style={[styles.currency, currencyStyle]}>
        <AppText style={[styles.usd, usdStyle]}>{formatNumber(satsToUsd(sats), 2)}</AppText>
        <AppText style={[styles.usdLabel, usdLabelStyle]}>USD</AppText>
      </View>
    </>
  );
}

const styles = StyleSheet.create({  
  currency: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 1
  },
  sats: {
    ...Typography.fontFamily.sfProTextLight,
    fontSize: 26,
    color: Colors.white
  },
  satsLabel: {
    fontSize: 18,
    color: Colors.middleGrey,
    marginLeft: 3
  },
  usd: {
    fontSize: 14,
    color: Colors.middleGrey
  },
  usdLabel: {
    fontSize: 10,
    color: Colors.quarterGrey,
    marginLeft: 3
  }
});
