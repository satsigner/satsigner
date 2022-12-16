import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ViewProps
} from 'react-native';

import GlobalStyles from '../../GlobalStyles';

import Button from '../shared/Button';
import Header from '../shared/Header';

interface Props {}

interface State {}

export class CreateParentAccount extends React.PureComponent<Props, State> {
  render() {
    return (
      <View style={styles.container}>
        <Header heading='Create New Parent Account'></Header>
        <View style={styles.content}>
          <View>
            <Text style={styles.accountNameLabel}>
              Account Name
            </Text>
            <TextInput style={styles.accountNameText}>
            </TextInput>
          </View>
          <View style={styles.actions}>
            <Button title='Generate New Secret Seed' onPress={this.notImplementedAlert}></Button>
            <Button title='Import Existing Seed' onPress={this.notImplementedAlert}></Button>
            <Button title='Import As Stateless' onPress={this.notImplementedAlert}></Button>
          </View>
        </View>
      </View>
    );
  }

  notImplementedAlert() {
    Alert.alert('Coming Soon...', 'Not yet implemented.', [{text: 'OK'}]);
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
    backgroundColor: '#242424',
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
