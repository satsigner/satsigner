import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';

import { NavigationProp } from '@react-navigation/native';

import { Typography, Layout, Colors } from '../styles';

import Button from './shared/Button';
import CheckboxGroup from './shared/CheckboxGroup';

interface Props {
  navigation: NavigationProp<any>
}

interface State {
}

export default class HomeScreen extends React.PureComponent<Props, State> {

  constructor(props: any) {
    super(props);

    this.state = {};
  }

  render() {
    return (
      <View style={styles.container}>
        <View>
          <Text style={styles.label}>
            Choose an action
          </Text>
        </View>
        <View style={styles.actions}>
          <Button title='Account List' onPress={() => this.props.navigation.navigate('AccountList')}></Button>
          <Button title='Confirm Words' onPress={() => this.props.navigation.navigate('ConfirmWord', { wordNum: 1 })}></Button>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({  
  container: {
    ...Layout.container.base,
    ...Layout.container.topPadded,
    ...Layout.container.horizontalPadded
  },
  actions: {
    justifyContent: 'space-evenly',
    marginVertical: 36
  },
  label: {
    ...Typography.textHighlight.x6,
    alignSelf: 'center',
    marginBottom: 7
  }
});
