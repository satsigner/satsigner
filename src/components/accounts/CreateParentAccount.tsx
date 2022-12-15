import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity
} from 'react-native';

interface Props {}

interface State {}

export class CreateParentAccount extends React.PureComponent<Props, State> {
  render() {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.text, styles.heading]}>Create New Parent Account</Text>
        </View>
        <View style={styles.content}>
          <View style={styles.accountName}>
            <Text style={[styles.text, styles.accountNameLabel]}>
              Account Name
            </Text>
            <TextInput style={[styles.text, styles.accountNameText]}>
            </TextInput>
          </View>
          <View style={styles.actions}>
            <Button title='Generate New Secret Seed'></Button>
            <Button title='Import Existing Seed'></Button>
            <Button title='Import As Stateless'></Button>
          </View>
        </View>
      </View>
    );
  }

  onPressHandler() {
    console.log('pressed');
  }
}

const Button = (props) => {
  return (
    <TouchableOpacity activeOpacity={0.5} style={styles.TouchableOpacity} onPress={this.onPressHandler}>
      <View style={styles.button}>
        <Text style={[styles.text, styles.buttonText]}>
          {props.title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({  
  text: {
    color: 'white'
  },
  container: {
    flex: 1    
  },
  header: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#222222',
  },
  heading: {
    textTransform: 'uppercase'
  },
  content: {
    flex: 9,
    justifyContent: 'space-evenly',
    alignItems: 'stretch',
    paddingHorizontal: '6%'
  },
  accountName: {
    alignItems: 'stretch'
  },
  accountNameLabel: {
    alignSelf: 'center'
  },
  accountNameText: {
    backgroundColor: '#242424',
  },
  actions: {
    height: '50%',
    justifyContent: 'space-evenly'
  },
  actionButton: {
  },
  TouchableOpacity: {
    borderRadius: 3,
    backgroundColor: '#434343',
    height: '16%'
  },
  button: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    textTransform: 'uppercase'
  }
});
