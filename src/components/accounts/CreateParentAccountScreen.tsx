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
import notImplementedAlert from '../shared/NotImplementedAlert';

import { AccountsContext } from './AccountsContext';
import { AccountCreationType } from '../../enums/AccountCreationType';

interface Props {
  navigation: NavigationProp<any>
}

interface State {
  accountName: string;
  submitEnabled: boolean;
}

export default class CreateParentAccountScreen extends React.PureComponent<Props, State> {
  static contextType = AccountsContext;

  constructor(props: any) {
    super(props);

    this.state = {
      accountName: '',
      submitEnabled: false
    };
  }

  accountCreationTypeSelected(accountCreationType: AccountCreationType) {
    if (this.context.hasAccountWithName(this.state.accountName)) {
      Alert.alert('Account with that name already exists');
      return;
    }
    this.context.setCurrentAccount({
      name: this.state.accountName,
      accountCreationType
    });
    this.props.navigation.navigate('AccountOptions');
  }
  
  render() {
    const { accountName, submitEnabled } = this.state;

    return (
      <AccountsContext.Consumer>
        {({setCurrentAccount, hasAccountWithName}) => (
          <View style={styles.container}>
            <View>
              <AppText style={styles.label}>
                Master Key Name
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
                title='Generate New Secret Seed'
                onPress={() => this.accountCreationTypeSelected(AccountCreationType.Generate)}
                disabled={! submitEnabled}
                style={[styles.submit, submitEnabled ? {} : styles.submitDisabled]}
              ></Button>

              <Button
                title='Import Existing Seed'
                onPress={() => this.accountCreationTypeSelected(AccountCreationType.Import)}
                disabled={! submitEnabled}
                style={[styles.submit, submitEnabled ? {} : styles.submitDisabled]}
              ></Button>

              <Button
                title='Import as Stateless'
                onPress={notImplementedAlert}
                style={[styles.submit, styles.submitDisabled]}
              ></Button>

              <Button
                title='Import Single Key (WIF)'
                onPress={notImplementedAlert}
                style={[styles.submit, styles.submitDisabled]}
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
    marginBottom: 7,
    textTransform: 'uppercase'
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
  submit: {
    backgroundColor: Colors.grey67,
    color: Colors.actionText,
    marginVertical: 7
  },
  submitDisabled: {
    opacity: 0.3
  },
});
