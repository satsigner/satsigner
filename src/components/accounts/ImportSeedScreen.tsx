import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet
} from 'react-native';

import { Typography, Layout, Colors } from '../../styles';

import Account from '../../models/Account';
import Button from '../shared/Button';

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
      words.push(<Word num={i+1} key={i}></Word>);
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
        <View style={styles.passphrase}>
          <Text style={styles.label}>
            Additional personal secret (optional)
          </Text>
          <TextInput
            style={styles.passphraseText}
            // value={this.state.account.name}
            // onChangeText={(accountName) => this.setAccount(accountName)}
          >
          </TextInput>
          <View style={styles.passphraseStatus}>
            <View style={styles.checksum}>
              <View style={styles.checksumStatus}></View>
              <Text style={styles.checksumStatusLabel}>invalid checksum</Text>
            </View>
            <View style={styles.fingerprint}>
              <Text style={styles.fingerprintLabel}>Fingerprint</Text>
              <Text style={styles.fingerprintValue}>af4261ff</Text>
            </View>
          </View>
        </View>
        <View>
          <Button
            title="Save Secret Seed"
            style={{
              backgroundColor: Colors.defaultActionBackground,
              color: Colors.defaultActionText
            }}
          ></Button>
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
  },
  passphrase: {
    marginTop: 32
  },
  passphraseText: {
    ...Typography.textHighlight.x12,
    backgroundColor: Colors.inputBackground,
    fontWeight: '300',
    textAlign: 'center',
    padding: 13.6,
    borderRadius: 3,
    letterSpacing: 0.6
  },
  passphraseStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 14
  },
  checksum: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  checksumStatus: {
    width: 11,
    height: 11,
    borderRadius: 11 / 2,
    backgroundColor: Colors.invalid,
    marginRight: 5,
    marginTop: 1
  },
  checksumStatusLabel: {
    ...Typography.textHighlight.x5
  },
  fingerprint: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  fingerprintLabel: {
    ...Typography.textMuted.x5,
    marginRight: 5
  },
  fingerprintValue: {
    ...Typography.textNormal.x5
  },
});
