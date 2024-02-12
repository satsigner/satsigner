import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Easing,
} from 'react-native';
import { NavigationProp } from '@react-navigation/native';

import { Typography, Layout } from '../styles';

import Button from './shared/Button';
import AnimatedNumber from './shared/AnimatedNumber';

interface Props {
  navigation: NavigationProp<any>
}

interface State {
  num: number;
}

export default class HomeScreen extends React.PureComponent<Props, State> {

  constructor(props: any) {
    super(props);

    this.state = {
      num: 0
    };
  }

  increase = () => {
    this.setState({num: this.state.num + 9});
  };

  render() {

    const { num } = this.state;

    return (
      <View style={styles.container}>
        <View>
          <Text style={styles.label}>
            Choose an action
          </Text>
        </View>
        <View style={styles.actions}>
          <Button title='Account List' onPress={() => this.props.navigation.navigate('AccountList')}></Button>
        </View>
        <View>
        <AnimatedNumber
          animateToNumber={num}
          fontStyle={{fontSize: 50, fontWeight: 'bold', color: 'white'}}
          animationDuration={500}
          includeComma={false}
          //=easing={Easing.inOut}
        />
        <Button title="increase" onPress={this.increase} />
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({  
  container: {
    ...Layout.container.base,
    ...Layout.container.topPadded,
    ...Layout.container.horizontalPadded
  },
  actions: {
    justifyContent: 'space-evenly',
    marginVertical: 36
  },
  label: {
    ...Typography.textHighlight.x6,
    alignSelf: 'center',
    marginBottom: 7
  }
});
