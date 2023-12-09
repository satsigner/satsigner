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
import AccountListScreen from './components/accounts/AccountListScreen';
import PlaceholderScreen from './components/PlaceholderScreen';

import NavUtils from './utils/NavUtils';
import { AccountsProvider } from './components/accounts/AccountsProvider';

const Stack = createNativeStackNavigator();

interface State {
}

export default class App extends React.Component<{}, State> {
  
  appTitle = 'Sat Signer';

  constructor(props: any) {
    super(props);
  }

  render() {
    return (
      <AccountsProvider>
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
                options={NavUtils.getHeaderOptions(this.appTitle)}
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
                name="AccountList"
                component={AccountListScreen}
                options={NavUtils.getHeaderOptions(this.appTitle)}
              />
            <Stack.Screen
              name="Placeholder"
                component={PlaceholderScreen}
                options={NavUtils.getHeaderOptions('Placeholder')}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </View>
      </AccountsProvider>
    );
  }
}

const styles = StyleSheet.create({  
  container: {
    ...Layout.container.base,
  }
});
