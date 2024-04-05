import React from 'react';
import { View } from 'react-native';

import { AppText } from '../../shared/AppText';
import { Account as AccountModel } from '../../../models/Account';
import numFormat from '../../../utils/numFormat';
import RightArrow from '../../../assets/images/right-arrow.svg';
import { styles } from './styles';

interface Props {
  accounts: AccountModel[];
}
export default function Accounts({ accounts }: Props) {
  return accounts.map((account, i) => (
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
  ));
}
