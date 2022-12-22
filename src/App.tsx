import React from 'react';
import {SafeAreaView, StyleSheet, View} from 'react-native';
import InputHistoryExplorer from './components/signing/InputHistortyExplorer';

import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import { Colors } from './styles';

import {Home} from './components/HomeScreen';
import Placeholder from './components/PlaceholderScreen';

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
      <NavigationContainer>
        <Stack.Navigator
          defaultScreenOptions={{
            headerTintColor: Colors.white,
          }}
          screenOptions={{
            presentation: 'transparentModal'
          }}            
        >
        <Stack.Screen
            name="Home"
            component={Home}            
            options={NavUtils.getHeaderOptions('Sat Signer')}
          />
          <Stack.Screen
            name="Placeholder1"
            component={Placeholder}
            options={NavUtils.getHeaderOptions('Placeholder 1')}
          />
          <Stack.Screen
            name="Placeholder2"
            component={Placeholder}
            options={NavUtils.getHeaderOptions('Placeholder 2')}
          />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }
}
