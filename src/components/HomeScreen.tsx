import { NavigationProp } from '@react-navigation/native';
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';

import GlobalStyles from '../GlobalStyles';

import Button from './shared/Button';

interface Props {
  navigation: NavigationProp<any>
}

interface State {
}

export class Home extends React.PureComponent<Props, State> {

  constructor(props: any) {
    super(props);

    this.state = {};
  }

  render() {
    return (
      <View style={GlobalStyles.container}>
        <View style={GlobalStyles.content}>
          <View>
            <Text style={GlobalStyles.label}>
              Choose an action
            </Text>
          </View>
          <View style={styles.actions}>
          <Button title='Placeholder 1' onPress={() => this.props.navigation.navigate('Placeholder1')}></Button>
          <Button title='Placeholder 2' onPress={() => this.props.navigation.navigate('Placeholder2')}></Button>
          </View>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({  
  actions: {
    justifyContent: 'space-evenly',
    marginVertical: 36
  },
});
