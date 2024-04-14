import { useEffect, useContext, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl
} from 'react-native';

import { NavigationProp } from '@react-navigation/native';

import { Descriptor } from 'bdk-rn';
import { Network } from 'bdk-rn/lib/lib/enums';

import navUtils from '../../utils/NavUtils';
import { Typography, Colors, Layout } from '../../styles';
import { AppText } from '../../components/shared/AppText';

import { AccountsContext } from '../../components/accounts/AccountsContext';

import BackgroundGradient from '../../components/shared/BackgroundGradient';
import RefreshIcon from '../../assets/images/refresh.svg';

import { Transaction } from '../../models/Transaction';
import { SortDirection } from '../../enums/SortDirection';

import { Sats } from '../../components/accounts/Sats';
import TransactionItem from './components/TransactionItem';
import ActionBar from './components/ActionBar';
import AccountSummaryTabs from './components/AccountSummaryTabs';
import GradientSeparator from './components/GradientSeparator';
import SortDirectionToggle from './components/SortDirectionToggle';

interface Props {
  navigation: NavigationProp<any>;
}

export default function AccountTransactionsScreen({
  navigation
}: Props) {
  const accountsContext = useContext(AccountsContext);
  const { currentAccount } = accountsContext;

  const [refreshing, setRefreshing] = useState(false);
  const [blockchainHeight, setBlockchainHeight] = useState<number>(0);
  const [sortDirection, setSortDirection] = useState(SortDirection.Descending);

  const onRefresh = useCallback(() => {
    (async() => {
      setRefreshing(true);      
      await refresh();
      setRefreshing(false);
    })();
  }, []);

  useEffect(() => {
    navUtils.setHeaderTitle(currentAccount.name, navigation);
  }, []);

  useEffect(() => {
    (async() => {
      await refresh();
    })();

    return () => {};
  }, []);

  async function refresh() {
    await refreshBlockchainHeight();
    await refreshAccount();  
  }

  async function refreshBlockchainHeight() {
    console.log('Retreiving blockchain height...');
    const height = await accountsContext.getBlockchainHeight();
    console.log('Blockchain Height', height);
    setBlockchainHeight(height);
  }

  async function refreshAccount() {
    const externalDescriptor = await new Descriptor()
      .create(currentAccount.external_descriptor as string, Network.Testnet);
    const internalDescriptor = await new Descriptor()
      .create(currentAccount.internal_descriptor as string, Network.Testnet);

    const wallet = await accountsContext.loadWalletFromDescriptor(externalDescriptor, internalDescriptor);
    console.log('Syncing wallet...');

    await accountsContext.syncWallet(wallet);
    console.log('Completed wallet sync.');

    await accountsContext.populateWalletData(wallet, currentAccount);
    await accountsContext.storeAccount(currentAccount);
  }

  function sortTransactions(transactions: Transaction[]): Transaction[] {
    return transactions?.sort(
      sortDirection === SortDirection.Ascending ?
        compareTransactionsAsc :
        compareTransactionsDesc
    );
  }

  function compareTransactionsAsc(txn1: Transaction, txn2: Transaction) {
    const t1 = new Date(txn1.timestamp as Date);
    const t2 = new Date(txn2.timestamp as Date);
    return (t1?.getTime() || 0) - (t2?.getTime() || 0);
  }

  function compareTransactionsDesc(txn1: Transaction, txn2: Transaction) {
    const t1 = new Date(txn1.timestamp as Date);
    const t2 = new Date(txn2.timestamp as Date);
    return (t2?.getTime() || 0) - (t1?.getTime() || 0);
  }

  return (
    <View style={styles.container}>
      <BackgroundGradient orientation={'horizontal'}>
        <View style={styles.header}>
          <Sats sats={currentAccount?.summary?.balanceSats} satsStyle={styles.sats} satsLabelStyle={styles.satsLabel} usdStyle={styles.usd} usdLabelStyle={styles.usdLabel} />
        </View>
        <GradientSeparator />
        <ActionBar />
        <GradientSeparator />
        <AccountSummaryTabs summary={currentAccount.summary}/>
      </BackgroundGradient>
      <View style={styles.transactionsHeaderContainer}>
        <View style={styles.transactionsHeader}>
          <TouchableOpacity
            style={styles.action}
            activeOpacity={0.7}
            onPress={onRefresh}
          >
            <RefreshIcon width={18} height={18} />                
          </TouchableOpacity>
          { refreshing ?
            <AppText style={[styles.transactionsHeaderText, styles.transactionsHeaderTextRefreshing]}>Updating Parent Account Activity...</AppText> :
            <AppText style={styles.transactionsHeaderText}>Parent Account Activity</AppText>
          }
          <SortDirectionToggle
            style={styles.action}
            onDirectionChanged={(direction: SortDirection) => setSortDirection(direction)}
          />
        </View>
      </View>
      <ScrollView style={styles.transactions}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.white]}
            tintColor={Colors.white}
          />
        }
      >
        { sortTransactions(currentAccount?.transactions).map(txn =>
          <TransactionItem
            key={txn.txid}
            transaction={txn}
            blockchainHeight={blockchainHeight}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({  
  container: {
    ...Layout.container.base
  },
  header: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 100,
    paddingBottom: 15
  },
  sats: {
    ...Typography.fontFamily.sfProTextUltraLight,
    fontSize: 50,
    marginLeft: 40
  },
  satsLabel: {
    fontSize: 21,
    marginLeft: 0
  },
  usd: {
    fontSize: 15
  },
  usdLabel: {
    fontSize: 11
  },
  transactionsHeaderContainer: {
    width: '90%',
    marginHorizontal: '5%',
    height: 61,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: -16,
    width: '100%'
  },
  action: {
    paddingVertical: 12
  },
  transactionsHeaderText: {
    color: Colors.grey130,
    marginTop: 0,
    ...Typography.fontSize.x4
  },
  transactionsHeaderTextRefreshing: {
    color: Colors.white
  },
  transactions: {
    marginHorizontal: '5%',
    height: '100%'
  }
});
