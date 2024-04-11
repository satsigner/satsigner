import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';

import { AppText } from '../shared/AppText';
import { Account } from '../../models/Account';
import numFormat from '../../utils/numFormat';
import RightArrow from '../../assets/images/right-arrow.svg';
import { Typography, Colors } from '../../styles';

interface Props {
  accounts: Account[];
  onAccountSelected: (account: Account) => void;
}

export default function Accounts({ accounts, onAccountSelected }: Props) {
  return accounts.map((account, i) => (
    <TouchableOpacity
        key={i}
        activeOpacity={0.5}
        onPress={() => onAccountSelected(account)}
    >
      <View style={styles.account} key={i}>
        <View style={styles.info}>
          <View>
            <AppText style={styles.fingerprint}>{account.fingerprint}</AppText>
          </View>
          <View>
            <AppText style={styles.accountName}>{account.name}</AppText>
          </View>
          <View style={styles.currency}>
            <AppText style={styles.sats}>
              {numFormat(account?.snapshot?.balanceSats)}
            </AppText>
            <AppText style={styles.satsLabel}>sats</AppText>
          </View>
          <View style={styles.currency}>
            <AppText style={styles.usd}>
              {numFormat(account?.snapshot?.balanceUsd, 2)}
            </AppText>
            <AppText style={styles.usdLabel}>USD</AppText>
          </View>
          <View style={styles.metrics}>
            <View>
              <AppText style={styles.metric}>
                {numFormat(account?.snapshot?.numAddresses)}
              </AppText>
              <View>
                <AppText style={styles.metricLabel}>Child</AppText>
                <AppText style={styles.metricLabel}>Accounts</AppText>
              </View>
            </View>
            <View>
              <AppText style={styles.metric}>
                {numFormat(account?.snapshot?.numTransactions)}
              </AppText>
              <View>
                <AppText style={styles.metricLabel}>Total</AppText>
                <AppText style={styles.metricLabel}>Transactions</AppText>
              </View>
            </View>
            <View>
              <AppText style={styles.metric}>
                {numFormat(account?.snapshot?.numUtxos)}
              </AppText>
              <View>
                <AppText style={styles.metricLabel}>Spendable</AppText>
                <AppText style={styles.metricLabel}>Outputs</AppText>
              </View>
            </View>
            <View>
              <AppText style={styles.metric}>
                {numFormat(account?.snapshot?.satsInMempool)}
              </AppText>
              <View>
                <AppText style={styles.metricLabel}>Sats in</AppText>
                <AppText style={styles.metricLabel}>Mempool</AppText>
              </View>
            </View>
          </View>
        </View>
        <View>
          <RightArrow />
        </View>
      </View>
    </TouchableOpacity>
  ));
}

const styles = StyleSheet.create({
  info: {},
  account: {
    paddingBottom: 18,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.grey44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fingerprint: {
    ...Typography.textMuted.x1,
  },
  accountName: {
    fontSize: 15.5,
    marginTop: 2,
    color: Colors.middleGrey,
  },
  currency: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 1,
  },
  sats: {
    ...Typography.fontFamily.sfProTextLight,
    fontSize: 26,
    color: Colors.white,
  },
  satsLabel: {
    fontSize: 18,
    color: Colors.middleGrey,
    marginLeft: 3,
  },
  usd: {
    fontSize: 14,
    color: Colors.middleGrey,
  },
  usdLabel: {
    fontSize: 10,
    color: Colors.quarterGrey,
    marginLeft: 3,
  },
  metrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
    marginTop: 15,
  },
  metric: {
    fontSize: 14,
    color: Colors.white,
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 10,
    color: Colors.grey130,
  },
});
