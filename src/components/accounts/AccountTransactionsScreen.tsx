import { useEffect, useContext } from 'react';
import {
  View,
  StyleSheet,
  ScrollView
} from 'react-native';

import { NavigationProp } from '@react-navigation/native';

import navUtils from '../../utils/NavUtils';
import { Typography, Colors, Layout } from '../../styles';
import { AppText } from '../shared/AppText';

import { AccountsContext } from './AccountsContext';
import numFormat from '../../utils/numFormat';
import BackgroundGradient from '../shared/BackgroundGradient';

interface Props {
  navigation: NavigationProp<any>;
}

export default function AccountTransactionsScreen({
  navigation
}: Props) {
  const context = useContext(AccountsContext);

  useEffect(() => {
    navUtils.setHeaderTitle(context.currentAccount.name, navigation);
  }, []);

  return (
    <AccountsContext.Consumer>
      {({currentAccount: account}) => (
        <View style={styles.container}>
          <BackgroundGradient style={styles.header}>
            <View style={styles.currency}><AppText style={styles.sats}>{numFormat(account?.snapshot?.balanceSats)}</AppText><AppText style={styles.satsLabel}>sats</AppText></View>
            <View style={styles.currency}><AppText style={styles.usd}>{numFormat(account?.snapshot?.balanceUsd, 2)}</AppText><AppText style={styles.usdLabel}>USD</AppText></View>
          </BackgroundGradient>
          <View style={styles.actionBar}>
            <AppText>Actions</AppText>
          </View>
          <View style={styles.tabs}>
            <AppText>Tabs</AppText>
          </View>
          <View style={styles.transactionsHeader}>
            <AppText>Transactions Header</AppText>
          </View>
          <ScrollView style={styles.transactions}>
            <AppText>Transactions</AppText>
          </ScrollView>
        </View>
      )}
    </AccountsContext.Consumer>      
  );
}

const styles = StyleSheet.create({  
  container: {
    ...Layout.container.base
  },
  header: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 110,
    paddingBottom: 10,
    borderBottomColor: 'white',
    borderBottomWidth: 1
  },
  currency: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 1
  },
  sats: {
    ...Typography.fontFamily.sfProTextUltraLight,
    fontSize: 50,
    marginLeft: 40,
    color: Colors.white
  },
  satsLabel: {
    fontSize: 21,
    color: Colors.middleGrey,
    marginLeft: 0
  },
  usd: {
    fontSize: 15,
    color: Colors.middleGrey
  },
  usdLabel: {
    fontSize: 11,
    color: Colors.quarterGrey,
    marginLeft: 3
  },
  actionBar: {
    height: 75,
    borderBottomColor: 'white',
    borderBottomWidth: 1
  },
  tabs: {
    height: 75,
    borderBottomColor: 'white',
    borderBottomWidth: 1
  },
  transactionsHeader: {
    height: 75,
    borderBottomColor: 'white',
    borderBottomWidth: 1
  },
  transactions: {

  }
});



