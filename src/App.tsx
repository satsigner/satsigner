import React from 'react';
import {SafeAreaView, StyleSheet, View} from 'react-native';
import InputHistoryExplorer from './components/inputHistory/InputHistortyExplorer';

interface State {}

export default class App extends React.Component<{}, State> {
  constructor(props: any) {
    super(props);

    this.state = {};
  }

  render() {
    return (
      <SafeAreaView style={styles.container}>
        <InputHistoryExplorer />
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131313',
  },
});
