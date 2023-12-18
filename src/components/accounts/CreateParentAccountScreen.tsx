import React, { useContext } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { NavigationProp } from '@react-navigation/native';

import { Typography, Layout, Colors } from '../../styles';

import Button from '../shared/Button';
import { AppText } from '../shared/AppText';

import { AccountsContext } from './AccountsContext';

interface Props {
  navigation: NavigationProp<any>
}

interface State {
  accountName: string;
  submitEnabled: boolean;
}

export default class CreateParentAccountScreen extends React.PureComponent<Props, State> {
  
  constructor(props: any) {
    super(props);

    this.state = {
      accountName: '',
      submitEnabled: false
    };
  }

  render() {
    const { accountName, submitEnabled } = this.state;

    return (
      <AccountsContext.Consumer>
        {({setCurrentAccount, hasAccountWithName}) => (
          <View style={styles.container}>
            <View>
              <AppText style={styles.label}>
                Account Name
              </AppText>
              <TextInput
                style={styles.accountNameText}
                value={accountName}
                onChangeText={(accountName) => this.setAccountName(accountName)}
              >
              </TextInput>
            </View>
            <View style={styles.actions}>
              <Button
                title='Create Parent Account'
                onPress={() => {
                  if (hasAccountWithName(accountName)) {
                    Alert.alert('Account with that name already exists');
                    return;
                  }
                  setCurrentAccount({name: accountName});
                  this.props.navigation.navigate('AccountOptions');
                }}
                disabled={! submitEnabled}
                style={submitEnabled ? styles.submitEnabled : styles.submitDisabled }
              ></Button>
            </View>
          </View>
        )}
      </AccountsContext.Consumer>
    );
  }

  setAccountName(accountName: string) {
    this.setState({
      submitEnabled: accountName.length > 0,
      accountName
    });
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
    ...Typography.fontFamily.sfProTextLight,
    backgroundColor: Colors.inputBackground,
    textAlign: 'center',
    height: 56,
    borderRadius: 3,
  },
  actions: {
    justifyContent: 'space-evenly',
    marginVertical: 36
  },
  submitEnabled: {
    backgroundColor: Colors.defaultActionBackground,
    color: Colors.defaultActionText,
  },
  submitDisabled: {
    backgroundColor: Colors.disabledActionBackground,
    color: Colors.disabledActionText
  },
});
