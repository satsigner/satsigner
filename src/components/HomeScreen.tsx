import {NavigationProp} from '@react-navigation/native';
import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

import {Typography, Layout} from '../styles';

import Button from './shared/Button';

interface Props {
  navigation: NavigationProp<any>;
}

interface State {}

export class Home extends React.PureComponent<Props, State> {
  constructor(props: any) {
    super(props);

    this.state = {};
  }

  render() {
    return (
      <View style={styles.container}>
        <View>
          <Text style={styles.label}>Choose an action</Text>
        </View>
        <View style={styles.actions}>
          <Button
            title="Input Bubble View"
            onPress={() =>
              this.props.navigation.navigate('InputBubbleView')
            }></Button>
          <Button
            title="Placeholder 2"
            onPress={() =>
              this.props.navigation.navigate('Placeholder2')
            }></Button>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    ...Layout.container.base,
    ...Layout.container.topPadded,
    ...Layout.container.horizontalPadded,
  },
  actions: {
    justifyContent: 'space-evenly',
    marginVertical: 36,
  },
  label: {
    ...Typography.textHighlight.x6,
    alignSelf: 'center',
    marginBottom: 7,
  },
});
