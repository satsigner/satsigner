import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';

import { Typography, Layout } from '../../styles';

import Account from '../../models/Account';

interface Props {}

interface State {
  account: Account
}

export default class ImportSeedScreen extends React.PureComponent<Props, State> {
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
      <View style={styles.container}>
        <View>
          <Text style={styles.label}>
            Mnemonic Seed Words (BIP39)
          </Text>
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
  label: {
    ...Typography.textHighlight.x5,
    alignSelf: 'center',
    marginBottom: 7
  },
});
