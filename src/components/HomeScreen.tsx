import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';

import { NavigationProp } from '@react-navigation/native';
import BouncyCheckboxGroup, { ICheckboxButton } from 'react-native-bouncy-checkbox-group';

import { Typography, Layout, Colors } from '../styles';

import Button from './shared/Button';

const CheckIcon = require('../assets/images/check.png');

interface Props {
  navigation: NavigationProp<any>
}

interface State {
}

export default class HomeScreen extends React.PureComponent<Props, State> {

  constructor(props: any) {
    super(props);

    this.state = {};
  }

  render() {
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
        <BouncyCheckboxGroup
          data={[
            {
              id: 0,
              iconStyle: {
                borderRadius: 4
              },
              iconImageStyle: {
                tintColor: Colors.grey191,
                width: 17,
                height: 17                
              },
              checkIconImageSource: CheckIcon,
              size: 32,
              innerIconStyle: {
                borderRadius: 4,
                borderWidth: 2,
                borderColor: 'rgba(255, 255, 255, 0.68)'
              },
              unfillColor: 'rgba(255, 255, 255, 0.17)',
              fillColor: 'rgba(255, 255, 255, 0.22)',
            }
          ]}
          style={{ flexDirection: "column" }}
          onChange={(selectedItem: ICheckboxButton) => {
            console.log("SelectedItem: ", JSON.stringify(selectedItem));
          }}
        />
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
