import React from 'react';

import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {Home} from './components/HomeScreen';
import {CreateParentAccount} from './components/accounts/CreateParentAccount';
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
            headerTintColor: 'white',
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
            name="CreateParentAccount"
            component={CreateParentAccount}
            options={NavUtils.getHeaderOptions('Create New Parent Account')}
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
