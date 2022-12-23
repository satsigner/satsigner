import React from 'react';

import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import { Colors } from './styles';

import HomeScreen from './components/HomeScreen';
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
            component={HomeScreen}            
            options={NavUtils.getHeaderOptions('Sat Signer')}
          />
          <Stack.Screen
            name="Placeholder1"
            component={PlaceholderScreen}
            options={NavUtils.getHeaderOptions('Placeholder 1')}
          />
          <Stack.Screen
            name="Placeholder2"
            component={PlaceholderScreen}
            options={NavUtils.getHeaderOptions('Placeholder 2')}
          />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }
}
