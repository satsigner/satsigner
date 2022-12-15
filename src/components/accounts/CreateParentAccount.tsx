import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

interface Props {}

interface State {}

export class CreateParentAccount extends React.PureComponent<Props, State> {
  render() {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#151515', '#2F2F2F']}
          start={{
            x: 0.94,
            y: 1.0
          }}
          end={{
            x: 0.86,
            y: -0.64
          }}
          style={styles.header}
        >
          <Text style={[styles.text, styles.heading]}>Create New Parent Account</Text>
        </LinearGradient>
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
    <View style={{minHeight: 85}}>
      <TouchableOpacity
        activeOpacity={0.5}
        style={[styles.TouchableOpacity, {height: 62}]}
        onPress={this.onPressHandler}
      >
        <View style={styles.button}>
          <Text style={[styles.text, styles.buttonText]}>
            {props.title}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({  
  text: {
    color: 'white',
    letterSpacing: 1,
    fontSize: 13
  },
  container: {
    flex: 1    
  },
  header: {
    height: 75,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heading: {
    textTransform: 'uppercase'
  },
  content: {
    flex: 1,
    justifyContent: 'space-evenly',
    alignItems: 'stretch',
    paddingHorizontal: '6%'
  },
  accountName: {
  },
  accountNameLabel: {
    alignSelf: 'center',
    marginBottom: 7
  },
  accountNameText: {
    backgroundColor: '#242424',
    fontSize: 20,
    fontWeight: '300',
    textAlign: 'center',
    padding: 13.6,
    borderRadius: 3,
    letterSpacing: 0.6
  },
  actions: {
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
