import React from 'react';
import { View, TouchableOpacity } from 'react-native';

import { NavigationProp } from '@react-navigation/native';

import { Sats } from '../Sats';

import { AppText } from '../../shared/AppText';
import { Account } from '../../../models/Account';
import numFormat from '../../../utils/numFormat';
import RightArrow from '../../../assets/images/right-arrow.svg';
import { styles } from './styles';
import { AccountsContext } from '../AccountsContext';

interface Props {
  accounts: Account[];
  navigation: NavigationProp<any>;
}

export default function Accounts({ accounts, navigation }: Props) {
  return (
    <AccountsContext.Consumer>
      {({ setCurrentAccount }) => (
        <>
          { accounts.map((account, i) => (            
            <TouchableOpacity
              key={i}
              activeOpacity={0.5}
              onPress={() => {
                setCurrentAccount(account);
                navigation.navigate('AccountTransactions');
              }}
            >
              <View style={styles.account}>
                <View style={styles.info}>
                  <View>
                    <AppText style={styles.fingerprint}>{account.fingerprint}</AppText>
                  </View>
                  <View>
                    <AppText style={styles.accountName}>{account.name}</AppText>
                  </View>
                  <Sats sats={account?.snapshot?.balanceSats} />
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
                <View style={styles.openAccount}>
                  <RightArrow height={12} width={5}/>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </>
      )}

    </AccountsContext.Consumer>
  );
}
