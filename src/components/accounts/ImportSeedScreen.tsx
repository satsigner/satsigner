import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';

import { Colors } from '../../Colors';
import GlobalStyles from '../../GlobalStyles';

import Account from '../../models/Account';

interface Props {}

interface State {
  account: Account
}

export class ImportSeedScreen extends React.PureComponent<Props, State> {
  constructor(props: any) {
    super(props);

    this.state = {
      account: {
        name: ''
      }
    };
  }

  render() {
    return (
      <View style={GlobalStyles.container}>
        <View style={GlobalStyles.content}>
          <View>
            <Text style={GlobalStyles.label}>
              import seed screen...
            </Text>
          </View>
        </View>
      </View>
    );
  }

}

const styles = StyleSheet.create({  

});
