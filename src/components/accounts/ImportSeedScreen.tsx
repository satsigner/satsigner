import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
} from 'react-native';

import { Typography, Layout, Colors } from '../../styles';

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
    const words = [];
    for (let i = 0; i < 12; i++) {
      words.push(<Word num={i+1}></Word>);
    }
    
    return (
      <View style={styles.container}>
        <View>
          <Text style={styles.label}>
            Mnemonic Seed Words (BIP39)
          </Text>
          <View style={styles.words}>
            {words}
          </View>
        </View>
      </View>
    );
  }

}

function Word(props: any) {
  return (
    <View style={styles.word}>
      <TextInput style={styles.wordText}></TextInput>
      <Text style={styles.wordNumLabel}>{props.num}</Text>
    </View>
  );
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
  words: {
    flexDirection: 'column',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'space-between',
    height: 198
  },
  word: {
    height: 44,
    width: '32%',
    justifyContent: 'flex-start',
    alignContent: 'center',
  },
  wordNumLabel: {
    position: 'absolute',
    top: 2,
    left: 5,
    ...Typography.textNormal.x5,
  },
  wordText: {
    ...Typography.textHighlight.x9,
    backgroundColor: Colors.inputBackground,
    fontWeight: '300',
    textAlign: 'center',
    borderRadius: 3,
    letterSpacing: 0.6
  }
});
