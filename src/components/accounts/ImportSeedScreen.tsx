import React from 'react';
import {
  View,
  ScrollView,
  TextInput,
  StyleSheet,
  Alert
} from 'react-native';

import { Result } from '@synonymdev/result';
import { Wallet, Bdk } from 'react-native-bdk';
import { AddressInfo } from '/Users/tom/Code/satsigner/react-native-bdk/src/utils/types';

import { Typography, Layout, Colors } from '../../styles';
import navUtils from '../../utils/NavUtils';

import { Account } from '../../models/Account';
import Button from '../shared/Button';
import { AppText } from '../shared/AppText';
import KeyboardAvoidingViewWithHeaderOffset from '../shared/KeyboardAvoidingViewWithHeaderOffset';

import { AccountsContext } from './AccountsContext';
import { SeedWords } from '../../enums/SeedWords';
import { AddressIndexVariant } from 'react-native-bdk/src/utils/types';

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

  async importSeed(loadWallet: (mnemonic: string) => void): Promise<boolean> {
    try {
      const mnemonic = this.state.seedWords.join(' ');
      // const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      // const mnemonic = 'border core pumpkin art almost hurry laptop yellow major opera salt muffin';
      console.log('mnemonic', mnemonic);

      await loadWallet(mnemonic);

      this.setState({checksumValid: true});
      return true;
    } catch (err) {
      console.error(err);
      Alert.alert('Error', '' + err, [{text: 'OK'}]);
      
      this.setState({checksumValid: false});
      return false;
    }
  }

  // TEMP hardcode
  satsToUsd(sats: number) {
    return sats / 100_000_000 * 40_000;
  }
  
  async logWallet() {
    if (await Wallet.sync()) {
      const balance = await Wallet.getBalance();
      console.log('balance', balance);
      console.log('balance sats', balance.confirmed);
      console.log('balance usd', this.satsToUsd(balance.confirmed));
      const addressResult: Result<AddressInfo> = await Bdk.getAddress({ indexVariant: AddressIndexVariant.NEW, index: 0 });
      const numAddresses = addressResult.isOk() ? addressResult.value.index + 1 : 0;
      console.log('child accounts', numAddresses);
      const transactions = await Wallet.listTransactions()
      console.log('total transactions', transactions.length);
      const utxosResult = await Bdk.listUnspent();
      const numUtxos = utxosResult.isOk() ? utxosResult.value.length : 0;      
      console.log('spendable outputs', numUtxos);
      console.log('utxos', utxosResult.value);
      const satsInMempool = balance.trustedPending + balance.untrustedPending;
      console.log('sats in mempool', satsInMempool);
    }
  }

  render() {
    const { checksumValid } = this.state;

    return (
      <AccountsContext.Consumer>
        {({currentAccount, loadWalletFromMnemonic}) => (
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
                    if (await this.importSeed(loadWalletFromMnemonic)) {
                      this.logWallet();
                    }
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
