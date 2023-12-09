import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet
} from 'react-native';

import Account from '../../models/Account';
import { Typography, Layout, Colors } from '../../styles';
import { AppText } from '../shared/AppText';

import RightArrow from '../../assets/images/right-arrow.svg';

import { AccountsContext } from './AccountsContext';

interface Props {}

interface State {}

export default class AccountListScreen extends React.PureComponent<Props, State> {
  static contextType = AccountsContext;

  constructor(props: any) {
    super(props);

    this.state = {
    };
  }

  render() {
    return (
      <AccountsContext.Consumer>
        {({accounts}) => (
          <View style={styles.container}>
            <ScrollView style={styles.scrollContainer}>
              <View>
                {this.getAccountComponents(accounts)}
              </View>
            </ScrollView>
          </View>
        )}
      </AccountsContext.Consumer>
    );
  }

  getAccountComponents(accounts: Account[]) {
    return accounts.map((account, i) => 
      <View style={styles.account} key={i}>
        <View style={styles.info}>
          <View><AppText style={styles.fingerprint}>36fade3a</AppText></View>
          <View><AppText style={styles.accountName}>{account.name}</AppText></View>
          <View style={styles.currency}><AppText style={styles.sats}>1,842,351</AppText><AppText style={styles.satsLabel}>sats</AppText></View>
          <View style={styles.currency}><AppText style={styles.usd}>392.03</AppText><AppText style={styles.usdLabel}>USD</AppText></View>
          <View style={styles.metrics}>
            <View>
              <AppText style={styles.metric}>2,552</AppText>
              <View>
                <AppText style={styles.metricLabel}>Child</AppText>
                <AppText style={styles.metricLabel}>Accounts</AppText>
              </View>
            </View>
            <View>
              <AppText style={styles.metric}>5,752</AppText>
              <View>
                <AppText style={styles.metricLabel}>Total</AppText>
                <AppText style={styles.metricLabel}>Transactions</AppText>
              </View>
            </View>
            <View>
              <AppText style={styles.metric}>34</AppText>
              <View>
                <AppText style={styles.metricLabel}>Spendable</AppText>
                <AppText style={styles.metricLabel}>Outputs</AppText>
              </View>
            </View>
            <View>
              <AppText style={styles.metric}>9,841</AppText>
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
    );
  }
}

const styles = StyleSheet.create({  
  container: {
    ...Layout.container.base,
    ...Layout.container.horizontalPaddedThin
  },
  scrollContainer: {
    ...Layout.container.topPadded
  },
  info: {
  },
  account: {
    paddingBottom: 10,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.grey44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  fingerprint: {
    ...Typography.textMuted.x1
  },
  accountName: {
    fontSize: 16,
    color: Colors.middleGrey
  },
  currency: {
    flexDirection: 'row'
  },
  sats: {
    ...Typography.fontFamily.sfProTextLight,
    fontSize: 26,
    color: Colors.white
  },
  satsLabel: {
    fontSize: 18,
    color: Colors.middleGrey
  },
  usd: {
    fontSize: 14,
    color: Colors.middleGrey
  },
  usdLabel: {
    fontSize: 10,
    color: Colors.quarterGrey
  },
  metrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%'
  },
  metric: {
    fontSize: 14,
    color: Colors.white
  },
  metricLabel: {
    fontSize: 10,
    color: Colors.grey130
  }
});
