import React from 'react';
import {StyleSheet, View} from 'react-native';
import {CreateParentAccount} from './components/accounts/CreateParentAccount';

import {COLORS} from './colors';

interface State {}

export default class App extends React.Component<{}, State> {
  constructor(props: any) {
    super(props);

    this.state = {};
  }

  render() {
    return (
      <View style={styles.container}>
        <CreateParentAccount />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray0,
  },
});
