import React from 'react';
import { View, StyleSheet } from 'react-native';
import './shim';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Colors, Layout } from './styles';

import HomeScreen from './components/HomeScreen';
import CreateParentAccountScreen from './components/accounts/CreateParentAccountScreen';
import AccountOptionsScreen from './components/accounts/AccountOptionsScreen';
import ImportSeedScreen from './components/accounts/ImportSeedScreen';
import GenerateSeedScreen from './components/accounts/GenerateSeedScreen';
import AccountListScreen from './components/accounts/AccountListScreen';
import AccountTransactionsScreen from './components/accounts/AccountTransactionsScreen';
import ConfirmWordScreen from './components/accounts/ConfirmWordScreen';
import AccountUtxosScreen from './components/accounts/AccountUtxosScreen';

import NavUtils from './utils/NavUtils';
import { AccountsProvider } from './components/accounts/AccountsProvider';
import { TransactionBuilderProvider } from './components/accounts/TransactionBuilderProvider';

const Stack = createNativeStackNavigator<RootStackParamList>();

const APP_TITLE = 'Sat Signer';

export default function App() {
  return (
    <AccountsProvider>
      <TransactionBuilderProvider>
        <View style={styles.container}>
          <NavigationContainer>
            <Stack.Navigator
              screenOptions={{
                headerTintColor: Colors.white,
              }}>
              <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={NavUtils.getHeaderOptions(APP_TITLE)}
              />
              <Stack.Screen
                name="CreateParentAccount"
                component={CreateParentAccountScreen}
                options={NavUtils.getHeaderOptions('Add Master Key')}
              />
              <Stack.Screen
                name="AccountOptions"
                component={AccountOptionsScreen}
                options={NavUtils.getHeaderOptions('Account Options')}
              />
              <Stack.Screen
                name="ImportSeed"
                component={ImportSeedScreen}
                options={NavUtils.getHeaderOptions('Import Existing Seed')}
              />
              <Stack.Screen
                name="GenerateSeed"
                component={GenerateSeedScreen}
                options={NavUtils.getHeaderOptions('Generate New Secret Seed')}
              />
              <Stack.Screen
                name="ConfirmWord"
                component={ConfirmWordScreen}
                options={NavUtils.getHeaderOptions('Confirm Word')}
              />
              <Stack.Screen
                name="AccountList"
                component={AccountListScreen}
                options={NavUtils.getHeaderOptions(APP_TITLE)}
              />
              <Stack.Screen
                name="AccountTransactions"
                component={AccountTransactionsScreen}
                options={NavUtils.getHeaderOptions(APP_TITLE, 'horizontal')}
              />
              <Stack.Screen
                name="AccountUtxos"
                component={AccountUtxosScreen}
                options={NavUtils.getHeaderOptions(APP_TITLE)}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </View>
      </TransactionBuilderProvider>
    </AccountsProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    ...Layout.container.base,
  },
});
