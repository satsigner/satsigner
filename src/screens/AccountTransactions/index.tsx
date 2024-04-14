import { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';

import { NavigationProp } from '@react-navigation/native';

import { Descriptor } from 'bdk-rn';
import { Network } from 'bdk-rn/lib/lib/enums';

import navUtils from '../../utils/NavUtils';
import { Typography, Colors, Layout } from '../../styles';
import { SortDirection } from '../../enums/SortDirection';

import { useAccountsContext } from '../../components/accounts/AccountsContext';
import BackgroundGradient from '../../components/shared/BackgroundGradient';
import { Sats } from '../../components/accounts/Sats';

import ActionBar from './components/ActionBar';
import AccountSummaryTabs from './components/AccountSummaryTabs';
import GradientSeparator from './components/GradientSeparator';
import TransactionList from './components/TransactionList';
import TransactionListHeader from './components/TransactionListHeader';

interface Props {
  navigation: NavigationProp<any>;
}

export default function AccountTransactionsScreen({
  navigation
}: Props) {
  const accountsContext = useAccountsContext();
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

  return (
    <View style={styles.container}>
      <BackgroundGradient orientation={'horizontal'}>
        <View style={styles.header}>
          <Sats sats={currentAccount?.summary?.balanceSats} satsStyle={styles.sats} satsLabelStyle={styles.satsLabel} usdStyle={styles.usd} usdLabelStyle={styles.usdLabel} />
        </View>
        <GradientSeparator />
        <ActionBar navigation={navigation} />
        <GradientSeparator />
        <AccountSummaryTabs summary={currentAccount.summary}/>
      </BackgroundGradient>
      <TransactionListHeader
        refreshing={refreshing}
        onRefresh={onRefresh}
        onSortDirectionChanged={(direction: SortDirection) => setSortDirection(direction)}
      />
      <TransactionList
        blockchainHeight={blockchainHeight}
        transactions={currentAccount?.transactions}
        sortDirection={sortDirection}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
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
  }
});
