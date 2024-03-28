import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity
} from 'react-native';

import { Account } from '../../models/Account';
import { Typography, Layout, Colors } from '../../styles';
import { AppText } from '../shared/AppText';
import Button from '../shared/Button';

import RightArrow from '../../assets/images/right-arrow.svg';

import { AccountsContext } from './AccountsContext';

import numFormat from '../../utils/numFormat';

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
          <>
          <View style={styles.createButtonContainer}>
            <Button gradientBackground={true} style={styles.createButton} title='Add Master Key' onPress={() => this.props.navigation.navigate('CreateParentAccount')}></Button>
          </View>
          <View style={styles.container}>
            <ScrollView style={styles.scrollContainer}>
              { accounts?.length === 0 &&
              <View style={styles.emptyList}>
                <AppText style={styles.emptyListText}>No Keys Yet</AppText>
              </View>
              }
              
              <View>
                {this.getAccountComponents(accounts)}
              </View>
            </ScrollView>
          </View>
          </>
        )}
      </AccountsContext.Consumer>
    );
  }

  getAccountComponents(accounts: Account[]) {
    return accounts.map((account, i) => 
      <TouchableOpacity
        key={i}
        activeOpacity={0.5}
        onPress={() => {
          this.context.setCurrentAccount(account);
          this.props.navigation.navigate('AccountTransactions');
        }}
      >
        <View style={styles.account}>
          <View style={styles.info}>
            <View><AppText style={styles.fingerprint}>{account.fingerprint}</AppText></View>
            <View><AppText style={styles.accountName}>{account.name}</AppText></View>
            <View style={styles.currency}><AppText style={styles.sats}>{numFormat(account?.snapshot?.balanceSats)}</AppText><AppText style={styles.satsLabel}>sats</AppText></View>
            <View style={styles.currency}><AppText style={styles.usd}>{numFormat(account?.snapshot?.balanceUsd, 2)}</AppText><AppText style={styles.usdLabel}>USD</AppText></View>
            <View style={styles.metrics}>
              <View>
                <AppText style={styles.metric}>{numFormat(account?.snapshot?.numAddresses)}</AppText>
                <View>
                  <AppText style={styles.metricLabel}>Child</AppText>
                  <AppText style={styles.metricLabel}>Accounts</AppText>
                </View>
              </View>
              <View>
                <AppText style={styles.metric}>{numFormat(account?.snapshot?.numTransactions)}</AppText>
                <View>
                  <AppText style={styles.metricLabel}>Total</AppText>
                  <AppText style={styles.metricLabel}>Transactions</AppText>
                </View>
              </View>
              <View>
                <AppText style={styles.metric}>{numFormat(account?.snapshot?.numUtxos)}</AppText>
                <View>
                  <AppText style={styles.metricLabel}>Spendable</AppText>
                  <AppText style={styles.metricLabel}>Outputs</AppText>
                </View>
              </View>
              <View>
                <AppText style={styles.metric}>{numFormat(account?.snapshot?.satsInMempool)}</AppText>
                <View>
                  <AppText style={styles.metricLabel}>Sats in</AppText>
                  <AppText style={styles.metricLabel}>Mempool</AppText>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.openAccount}>
            <RightArrow height={12} width={5}/>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

}

const styles = StyleSheet.create({  
  container: {
    ...Layout.container.base,
    ...Layout.container.horizontalPaddedThin
  },
  createButtonContainer: {
    backgroundColor: Colors.background,
  },
  createButton: {
    borderRadius: 0,
    marginTop: 0,
    borderTopColor: Colors.grey48,
    borderTopWidth: 1
  },
  scrollContainer: {
    paddingTop: 10,
  },
  emptyList: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 38
  },
  emptyListText: {
    textTransform: 'uppercase',
    color: Colors.grey62,
    ...Typography.fontSize.x5
  },
  info: {
  },
  openAccount: {
    position: 'absolute',
    right: 0,
    top: 50
  },
  account: {
    paddingBottom: 18,
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
    fontSize: 15.5,
    marginTop: 2,
    color: Colors.middleGrey
  },
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
  },
  metrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
    marginTop: 15
  },
  metric: {
    fontSize: 14,
    color: Colors.white,
    marginBottom: 2
  },
  metricLabel: {
    fontSize: 10,
    color: Colors.grey130
  }
});
