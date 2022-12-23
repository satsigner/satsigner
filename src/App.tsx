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
import ImportSeedScreen from './components/accounts/ImportSeedScreen';
import PlaceholderScreen from './components/PlaceholderScreen';

import NavUtils from './utils/NavUtils';

const Stack = createNativeStackNavigator();

interface State {}

export default class App extends React.Component<{}, State> {
  
  constructor(props: any) {
    super(props);

    this.state = {};
  }

  render() {
    return (
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
    );
  }
}

const styles = StyleSheet.create({  
  container: {
    ...Layout.container.base,
  }
});
