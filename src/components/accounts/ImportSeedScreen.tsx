import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet
} from 'react-native';

import { Typography, Layout, Colors } from '../../styles';
import navUtils from '../../utils/NavUtils';

import Account from '../../models/Account';
import Button from '../shared/Button';

import { AccountsContext } from './AccountsContext';
import { SeedWords } from '../../enums/SeedWords';

interface Props {}

interface State {
  account: Account
}

export default class ImportSeedScreen extends React.PureComponent<Props, State> {
  static contextType = AccountsContext;

  constructor(props: any) {
    super(props);

    this.state = {
      account: {
        name: ''
      }
    };
  }

  componentDidMount() {
    navUtils.setHeaderTitle(this.context.currentAccount.name, this.props.navigation);
  }

  componentDidUpdate() {
    navUtils.setHeaderTitle(this.context.currentAccount.name, this.props.navigation);
  }

  getWords(account: Account) {
    const numWords = account?.seedWords || 24;
    const words = [];
    for (let i = 0; i < numWords; i++) {
      words.push(<Word num={i+1} key={i}></Word>);
    }
    return words;
  }

  render() {
    return (
      <AccountsContext.Consumer>
        {({currentAccount, setCurrentAccount}) => (
          <View style={styles.container}>
            <View>
              <Text style={styles.label}>
                Mnemonic Seed Words (BIP39)
              </Text>
              <View style={[styles.words,
                currentAccount.seedWords === SeedWords.WORDS12 ? styles.words12 :
                currentAccount.seedWords === SeedWords.WORDS15 ? styles.words15 :
                currentAccount.seedWords === SeedWords.WORDS18 ? styles.words18 :
                currentAccount.seedWords === SeedWords.WORDS21 ? styles.words21 :
                currentAccount.seedWords === SeedWords.WORDS24 ? styles.words24 : {}
              ]}>
                {this.getWords(currentAccount)}
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
        )}
      </AccountsContext.Consumer>
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

const wordRowHeight = 49.25;

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
  },
  words12: {
    height: 4 * wordRowHeight
  },
  words15: {
    height: 5 * wordRowHeight
  },
  words18: {
    height: 6 * wordRowHeight
  },
  words21: {
    height: 7 * wordRowHeight
  },
  words24: {
    height: 8 * wordRowHeight
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
