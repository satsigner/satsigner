import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Accounts from './Accounts';
import Button from '../shared/Button';
import { AppText } from '../shared/AppText';
import { AccountsContext } from './AccountsContext';
import { Typography, Layout, Colors } from '../../styles';

export default function AccountListScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <AccountsContext.Consumer>
      {({ accounts, setCurrentAccount }) => (
        <>
          <View style={styles.createButtonContainer}>
            <Button
              gradientBackground={true}
              style={styles.createButton}
              title="Add Master Key"
              onPress={() => navigation.navigate('CreateParentAccount')}
            />
          </View>
          <View style={styles.container}>
            <ScrollView style={styles.scrollContainer}>
              {accounts?.length === 0 && (
                <View style={styles.emptyList}>
                  <AppText style={styles.emptyListText}>No Keys Yet</AppText>
                </View>
              )}
              <View>
                <Accounts accounts={accounts} onAccountSelected={(account) => {
                    setCurrentAccount(account);
                    navigation.navigate('AccountTransactions');
                  }} />
              </View>
            </ScrollView>
          </View>
        </>
      )}
    </AccountsContext.Consumer>
  );
}

const styles = StyleSheet.create({
  container: {
    ...Layout.container.base,
    ...Layout.container.horizontalPaddedThin,
  },
  createButtonContainer: {
    backgroundColor: Colors.background,
  },
  createButton: {
    borderRadius: 0,
    marginTop: 0,
    borderTopColor: Colors.grey48,
    borderTopWidth: 1,
  },
  scrollContainer: {
    paddingTop: 10,
  },
  emptyList: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 38,
  },
  emptyListText: {
    textTransform: 'uppercase',
    color: Colors.grey62,
    ...Typography.fontSize.x5,
  },
});
