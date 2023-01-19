import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
} from 'react-native';
import { NavigationProp } from '@react-navigation/native';

import { Typography, Layout, Colors } from '../../styles';

import Button from '../shared/Button';
import SelectButton from '../shared/SelectButton';

interface Props {
  navigation: NavigationProp<any>
}

interface State {
  // Policy Type
  // Script Version
  // Seed Length
}

export default class CreateParentAccountScreen extends React.PureComponent<Props, State> {
  constructor(props: any) {
    super(props);

    this.state = {
    };
  }

  render() {
    return (
      <View style={styles.container}>
        <View style={styles.options}>
          <View style={styles.option}>
            <Text style={styles.label}>
              Policy Type
            </Text>
            <SelectButton
              title="Single Signature"
            >
            </SelectButton>
          </View>
          <View style={styles.option}>
            <Text style={styles.label}>
              Script Version
            </Text>
            <SelectButton
              title="Nested SegWit (P2SH)"
            >
            </SelectButton>
          </View>
          <View style={styles.option}>
            <Text style={styles.label}>
              Mnemonic Seed Words (BIP39)
            </Text>
            <SelectButton
              title="12 words"
            >
            </SelectButton>
          </View>
        </View>
        <View style={styles.actions}>
          <Button
            title='Generate New Secret Seed'
            onPress={() => this.notImplementedAlert()}
            style={styles.defaultActionButton}
          ></Button>
          <Button
            title='Import Existing Seed'
            onPress={() => this.props.navigation.navigate('ImportSeed')}
            style={styles.additionalActionButton}
          ></Button>
          <Button
            title='Import As Stateless'
            onPress={() => this.notImplementedAlert()}
            style={styles.additionalActionButton}
          ></Button>
        </View>
      </View>
    );
  }

  notImplementedAlert() {
    Alert.alert(
      'Coming Soon...',
      'Not yet implemented.',
      [{text: 'OK'}]
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
    marginBottom: 0
  },
  defaultActionButton: {
    backgroundColor: Colors.defaultActionBackground,
    color: Colors.defaultActionText
  },
  additionalActionButton: {
    backgroundColor: Colors.additionalActionBackground,
    color: Colors.additionalActionText,
    borderColor: Colors.additionalActionBorder
  },
  options: {
  },
  option: {
    marginBottom: 6
  },
  actions: {
    justifyContent: 'space-evenly',
    marginVertical: 2
  },
});
