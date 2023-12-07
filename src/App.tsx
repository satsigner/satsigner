import React from 'react';
import {
  View,
  StyleSheet
} from 'react-native';

import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import { Colors, Layout } from './styles';

import HomeScreen from './components/HomeScreen';
import CreateParentAccountScreen from './components/accounts/CreateParentAccountScreen';
import AccountOptionsScreen from './components/accounts/AccountOptionsScreen';
import ImportSeedScreen from './components/accounts/ImportSeedScreen';
import PlaceholderScreen from './components/PlaceholderScreen';

import NavUtils from './utils/NavUtils';
import { AccountsContext } from './components/accounts/AccountsContext';
import Account from './models/Account';

const Stack = createNativeStackNavigator();

interface State {
  accounts: Account[];
  currentAccount: Account;
  setCurrentAccount: (account: Account) => void;
  addAccount: (account: Account) => void;
}

export default class App extends React.Component<{}, State> {
  
  constructor(props: any) {
    super(props);

    const setCurrentAccount = (account: Account) => {
      account.name = account.name.trim();

      this.setState({currentAccount: account});
    }

    const addAccount = (account: Account) => {
      this.setState({accounts: [...this.state.accounts, account]})
    }

    this.state = {
      accounts: [],
      currentAccount: new Account(),
      setCurrentAccount,
      addAccount
    };
  }

  render() {
    return (
      <AccountsContext.Provider value={this.state}>
        <View style={styles.container}>
          <NavigationContainer>
            <Stack.Navigator
              defaultScreenOptions={{
                headerTintColor: Colors.white,
              }}
            >
              <Stack.Screen
                name="Home"
                component={HomeScreen}            
                options={NavUtils.getHeaderOptions('Sat Signer')}
              />
              <Stack.Screen
                name="CreateParentAccount"
                component={CreateParentAccountScreen}
                options={NavUtils.getHeaderOptions('Create New Parent Account')}
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
              name="Placeholder"
                component={PlaceholderScreen}
                options={NavUtils.getHeaderOptions('Placeholder')}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </View>
      </AccountsContext.Provider>
    );
  }
}

const styles = StyleSheet.create({  
  container: {
    ...Layout.container.base,
  }
});
