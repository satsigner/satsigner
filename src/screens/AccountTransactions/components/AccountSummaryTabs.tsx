import { StyleSheet, View } from "react-native";

import { AccountSummary } from "../../../models/Account";
import numFormat from "../../../utils/numFormat";
import { Colors, Typography } from "../../../styles";
import { AppText } from "../../../components/shared/AppText";

import GradientSeparator from "./GradientSeparator";

interface Props {
  summary: AccountSummary;
}

export default function AccountSummaryTabs({
  summary
}: Props) {
  return (
    <>
      <View style={styles.tabs}>
        <View style={styles.metrics}>
          <View style={styles.metricContainer}>
            <AppText style={[styles.metric, styles.metricSelected]}>{numFormat(summary?.numTransactions)}</AppText>
            <View>
              <AppText style={[styles.metricLabel, styles.metricLabelSelected]}>Total{"\n"}Transactions</AppText>
            </View>
          </View>
          <View style={styles.metricContainer}>
            <AppText style={styles.metric}>{numFormat(summary?.numAddresses)}</AppText>
            <View>
              <AppText style={styles.metricLabel}>Child{"\n"}Accounts</AppText>
            </View>
          </View>
          <View style={styles.metricContainer}>
            <AppText style={styles.metric}>{numFormat(summary?.numUtxos)}</AppText>
            <View>
              <AppText style={styles.metricLabel}>Spendable{"\n"}Outputs</AppText>
            </View>
          </View>
          <View style={styles.metricContainer}>
            <AppText style={styles.metric}>{numFormat(summary?.satsInMempool)}</AppText>
            <View>
              <AppText style={styles.metricLabel}>Sats in{"\n"}Mempool</AppText>
            </View>
          </View>
        </View>
      </View>
      <GradientSeparator />
      <View style={[styles.metrics, styles.metricsNoMargin]}>
        {/* This view follows the structure of metrics defined above */}
        {/* its only purpose is to draw underline under transactions */}
        {/* but place it on top of the GradientSeparator, so it must come after in document order */}
        <View style={styles.metricContainer}>
          <View style={styles.metricUnderline}></View>
        </View>
        <View style={styles.metricContainer}></View>
        <View style={styles.metricContainer}></View>
        <View style={styles.metricContainer}></View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  tabs: {
    height: 67,
    justifyContent: 'center'
  },
  metrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 28,
    marginTop: 2
  },
  metricsNoMargin: {
    marginTop: 0
  },
  metricContainer: {
    display: 'flex',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    width: '20%',
    position: 'relative'
  },
  metric: {
    fontSize: 15,
    color: Colors.white + Colors.alpha50Percent,
    marginBottom: 4
  },
  metricSelected: {
    color: Colors.white,
  },
  metricLabel: {
    ...Typography.fontFamily.sfProDisplayRegular,
    fontSize: 11,
    lineHeight: 11,
    color: Colors.grey130 + Colors.alpha50Percent,
    letterSpacing: 1,
    textAlign: 'center'
  },
  metricLabelSelected: {
    color: Colors.grey130,
  },
  metricUnderline: {
    position: 'absolute',
    backgroundColor: Colors.white,
    height: 2,
    width: 75,
    bottom: 0
  }
})