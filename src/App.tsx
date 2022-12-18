import React from 'react';
import {StyleSheet, View} from 'react-native';

import {COLORS} from './colors';

import {Home} from './components/Home';

interface State {}

export default class App extends React.Component<{}, State> {
  constructor(props: any) {
    super(props);

    this.state = {};
  }

  render() {
    return (
      <View style={styles.container}>
        <Home />
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
