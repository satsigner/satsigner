import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
} from 'react-native';

import { COLORS } from '../colors';
import GlobalStyles from '../GlobalStyles';

import Button from './shared/Button';
import Header from './shared/Header';

interface Props {}

interface State {
}

export class Home extends React.PureComponent<Props, State> {

  constructor(props: any) {
    super(props);

    this.state = {};
  }

  render() {
    return (
      <View style={styles.container}>
        <Header heading='Home'></Header>
        <View style={styles.content}>
          <View>
            <Text style={styles.actionsLabel}>
              Choose an action
            </Text>
          </View>
          <View style={styles.actions}>
            <Button title='Placeholder 1' onPress={() => this.notImplementedAlert()}></Button>
            <Button title='Placeholder 2' onPress={() => this.notImplementedAlert()}></Button>
          </View>
        </View>
      </View>
    );
  }

  notImplementedAlert() {
    Alert.alert(
      'Coming Soon...',
      'Not yet implemented.',
      [{text: 'OK'}]
    );
  }
}

const styles = StyleSheet.create({  
  container: {
    flex: 1
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    marginTop: 30,
    paddingHorizontal: '6%'
  },
  actionsLabel: {
    ...GlobalStyles.text,
    alignSelf: 'center',
    marginBottom: 7
  },
  actions: {
    justifyContent: 'space-evenly',
    marginVertical: 36
  },
});
