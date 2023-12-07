import React from 'react';
import {
  View,
  ScrollView,
  TextInput,
  StyleSheet
} from 'react-native';
import { Bdk, Network } from 'react-native-bdk';

import { Typography, Layout, Colors } from '../../styles';
import navUtils from '../../utils/NavUtils';

import Account from '../../models/Account';
import Button from '../shared/Button';
import { AppText } from '../shared/AppText';
import KeyboardAvoidingViewWithHeaderOffset from '../shared/KeyboardAvoidingViewWithHeaderOffset';

import { AccountsContext } from './AccountsContext';
import { SeedWords } from '../../enums/SeedWords';

interface Props {}

interface State {
  seedWords: string[];
  passphrase: string;
  checksumValid: boolean;
}

export default class ImportSeedScreen extends React.PureComponent<Props, State> {
  static contextType = AccountsContext;

  constructor(props: any) {
    super(props);

    this.state = {
      seedWords: [],
      checksumValid: false
    };
  }

  componentDidMount() {
    navUtils.setHeaderTitle(this.context.currentAccount.name, this.props.navigation);
  }

  componentDidUpdate() {
    navUtils.setHeaderTitle(this.context.currentAccount.name, this.props.navigation);
  }

  getWordComponents(account: Account) {
    const numWords = account?.seedWords || 24;
    const words = [];
    for (let i = 0; i < numWords; i++) {
      words.push(
        <Word
          num={i+1}
          key={i}
          onChangeWord={this.setWord}
        ></Word>
      );
    }
    return words;
  }

  setWord = (word: string, index: number) => {
    this.setState((state) => {
      const { seedWords } = state;
      seedWords[index] = word;
      return { seedWords };
    });
  }

  setPassphrase(passphrase: string) {
    this.setState({passphrase});
  }

  async loadWallet() {
    try {
      const mnemonic = this.state.seedWords.join(' ');
      console.log('mnemonic', mnemonic);

      const wallet = await Bdk.loadWallet({
        mnemonic,
        config: {
          network: Network.Testnet
        },
      });
      
      console.log('wallet', wallet);
      this.setState({checksumValid: true});
    } catch (err) {
      console.error(err);
      this.setState({checksumValid: false});
    }
  }

  render() {
    const { checksumValid } = this.state;

    return (
      <AccountsContext.Consumer>
        {({currentAccount, setCurrentAccount, addAccount}) => (
          <KeyboardAvoidingViewWithHeaderOffset style={styles.container}>
            <ScrollView style={styles.scrollContainer}>
              <View>
                <AppText style={styles.label}>
                  Mnemonic Seed Words (BIP39)
                </AppText>
                <View style={[styles.words,
                  currentAccount.seedWords === SeedWords.WORDS12 ? styles.words12 :
                  currentAccount.seedWords === SeedWords.WORDS15 ? styles.words15 :
                  currentAccount.seedWords === SeedWords.WORDS18 ? styles.words18 :
                  currentAccount.seedWords === SeedWords.WORDS21 ? styles.words21 :
                  currentAccount.seedWords === SeedWords.WORDS24 ? styles.words24 : {}
                ]}>
                  {this.getWordComponents(currentAccount)}
                </View>
              </View>
              <View style={styles.passphrase}>
                <AppText style={styles.label}>
                  Additional personal secret (optional)
                </AppText>
                <TextInput
                  style={styles.passphraseText}
                  onChangeText={(passphrase) => this.setPassphrase(passphrase)}
                >
                </TextInput>
                <View style={styles.passphraseStatus}>
                  <View style={styles.checksum}>
                    <View style={[
                        styles.checksumStatus,
                        this.state.checksumValid ?
                          styles.checksumStatusValid :
                          styles.checksumStatusInvalid
                      ]}>
                    </View>
                    <AppText style={styles.checksumStatusLabel}>{ checksumValid ? <>valid</> : <>invalid</> } checksum</AppText>
                  </View>
                  <View style={styles.fingerprint}>
                    <AppText style={styles.fingerprintLabel}>Fingerprint</AppText>
                    <AppText style={styles.fingerprintValue}>af4261ff</AppText>
                  </View>
                </View>
              </View>
              <View>
                <Button
                  title="Save Secret Seed"
                  style={styles.submitAction}
                  onPress={async() => {
                    await this.loadWallet();
                    addAccount(currentAccount);
                  }}
                ></Button>
              </View>
            </ScrollView>
          </KeyboardAvoidingViewWithHeaderOffset>
        )}
      </AccountsContext.Consumer>
    );
  }

}

function Word(props: any) {
  return (
    <View style={styles.word}>
      <TextInput
        style={styles.wordText}
        onChangeText={(word) => props.onChangeWord(word, props.num - 1)}
      ></TextInput>
      <AppText style={styles.wordNumLabel}>{props.num}</AppText>
    </View>
  );
}

const wordRowHeight = 49.25;

const styles = StyleSheet.create({  
  container: {
    ...Layout.container.base,
    ...Layout.container.horizontalPadded
  },
  scrollContainer: {
    ...Layout.container.topPadded,
  },
  label: {
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
    top: 5,
    left: 5,
    ...Typography.textNormal.x4,
    lineHeight: Typography.fontSize.x4.fontSize
  },
  wordText: {
    ...Typography.textHighlight.x9,
    backgroundColor: Colors.inputBackground,
    fontWeight: '300',
    textAlign: 'center',
    borderRadius: 3,
    letterSpacing: 0.6,
    flex: 1
  },
  passphrase: {
    marginTop: 22
  },
  passphraseText: {
    ...Typography.textHighlight.x20,
    ...Typography.fontFamily.sfProTextLight,
    backgroundColor: Colors.inputBackground,
    textAlign: 'center',
    height: 60,
    padding: 0,
    borderRadius: 3,
  },
  passphraseStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10
  },
  checksum: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  checksumStatus: {
    width: 11,
    height: 11,
    borderRadius: 11 / 2,
    marginRight: 5,
    marginTop: 1
  },
  checksumStatusValid: {
    backgroundColor: Colors.valid
  },
  checksumStatusInvalid: {
    backgroundColor: Colors.invalid
  },
  checksumStatusLabel: {
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
  submitAction: {
    backgroundColor: Colors.defaultActionBackground,
    color: Colors.defaultActionText
  }
});
