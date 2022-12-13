import React from 'react';
import {View, Text, Button, StyleSheet} from 'react-native';

interface Props {}

interface State {}

export class CreateParentAccount extends React.PureComponent<Props, State> {
  render() {
    return (
      <View>
        <View style={styles.header}>
          <Text style={styles.text}>Create New Parent Account</Text>
        </View>
        <View style={styles.content}>

        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({  
  header: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#222222',
  },
  text: {
    color: 'white',
    textTransform: 'uppercase'
  },
  content: {
    flex: 9
  }
});
