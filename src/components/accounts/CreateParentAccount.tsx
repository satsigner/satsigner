import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ViewProps
} from 'react-native';

import { COLORS } from '../../colors';
import GlobalStyles from '../../GlobalStyles';

import Button from '../shared/Button';
import Header from '../shared/Header';

import Account from '../../models/Account';

interface Props {}

interface State {
  account: Account
}

export class CreateParentAccount extends React.PureComponent<Props, State> {
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
        <Header heading='Create New Parent Account'></Header>
        <View style={styles.content}>
          <View>
            <Text style={styles.accountNameLabel}>
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
    flex: 1
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    marginTop: 30,
    paddingHorizontal: '6%'
  },
  accountNameLabel: {
    ...GlobalStyles.text,
    alignSelf: 'center',
    marginBottom: 7
  },
  accountNameText: {
    ...GlobalStyles.text,
    backgroundColor: COLORS.gray2,
    fontSize: 20,
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
