import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';

import { Typography, Layout, Colors } from '../../styles';

import Button from '../shared/Button';

import Account from '../../models/Account';

interface Props {}

interface State {
  account: Account
}

export default class CreateParentAccountScreen extends React.PureComponent<Props, State> {
  constructor(props: any) {
    super(props);

    this.state = {
      account: {
        name: ''
      }
    };
  }

  render() {
    return (
      <View style={styles.container}>
        <View>
          <Text style={styles.label}>
            Account Name
          </Text>
          <TextInput
            style={styles.accountNameText}
            value={this.state.account.name}
            onChangeText={(accountName) => this.setAccount(accountName)}
          >
          </TextInput>
        </View>
        <View style={styles.actions}>
          <Button title='Generate New Secret Seed' onPress={() => this.notImplementedAlert()}></Button>
          <Button title='Import Existing Seed' onPress={() => this.notImplementedAlert()}></Button>
          <Button title='Import As Stateless' onPress={() => this.notImplementedAlert()}></Button>
        </View>
      </View>
    );
  }

  setAccount(accountName: string) {
    this.setState(
      {
        account: {
          name: accountName
        }
      }
    );
  }

  notImplementedAlert() {
    Alert.alert(
      'Coming Soon...',
      'Not yet implemented.\n' +
        `(Account Name = ${this.state.account.name})`,
      [{text: 'OK'}]
    );
  }
}

const styles = StyleSheet.create({  
  container: {
    ...Layout.container.base,
    ...Layout.container.topPadded,
    ...Layout.container.horizontalPadded
  },
  label: {
    ...Typography.textHighlight.x5,
    alignSelf: 'center',
    marginBottom: 7
  },
  accountNameText: {
    ...Typography.textHighlight.x12,
    backgroundColor: Colors.inputBackground,
    fontWeight: '300',
    textAlign: 'center',
    padding: 13.6,
    borderRadius: 3,
    letterSpacing: 0.6
  },
  actions: {
    justifyContent: 'space-evenly',
    marginVertical: 36
  },
});
