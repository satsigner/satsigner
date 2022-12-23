import React from 'react';
import {
  View,
  StyleSheet
} from 'react-native';

import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import { Colors, Layout } from './styles';

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
      </View>
    );
  }
}

const styles = StyleSheet.create({  
  container: {
    ...Layout.container.base,
  }
});
