import React from 'react';
import InputBubbleViewScreen from './components/signing/InputBubbleViewScreen';

import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {Colors} from './styles';

import {Home} from './components/HomeScreen';
import Placeholder from './components/PlaceholderScreen';

import NavUtils from './utils/NavUtils';
import {SafeAreaView, View} from 'react-native';

const Stack = createNativeStackNavigator();

interface State {}

export default class App extends React.Component<{}, State> {
  constructor(props: any) {
    super(props);

    this.state = {};
  }

  render() {
    return (
      <SafeAreaView style={{flex: 1, backgroundColor: Colors.background}}>
        <NavigationContainer>
          <Stack.Navigator
            defaultScreenOptions={{
              headerTintColor: Colors.white,
            }}>
            <Stack.Screen
              name="Home"
              component={Home}
              options={NavUtils.getHeaderOptions('Sat Signer')}
            />
            <Stack.Screen
              name="InputBubbleView"
              component={InputBubbleViewScreen}
              options={NavUtils.getHeaderOptions('Extra Security')}
            />
            <Stack.Screen
              name="Placeholder2"
              component={Placeholder}
              options={NavUtils.getHeaderOptions('Placeholder 2')}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaView>
    );
  }
}
