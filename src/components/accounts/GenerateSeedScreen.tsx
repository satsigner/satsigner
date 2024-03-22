import { PureComponent } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Alert
} from 'react-native';

import { NavigationProp } from '@react-navigation/native';

import * as bip39 from 'bip39';

import navUtils from '../../utils/NavUtils';

import KeyboardAvoidingViewWithHeaderOffset from '../shared/KeyboardAvoidingViewWithHeaderOffset';
import { Account } from '../../models/Account';
import Button from '../shared/Button';
import { AppText } from '../shared/AppText';

import { AccountsContext } from './AccountsContext';
import { SeedWordCount } from '../../enums/SeedWordCount';
import { SeedWordInfo } from './SeedWordInfo';
import { WordLabel } from './WordLabel';

import { SeedScreenStyles } from './SeedScreenStyles';

interface Props {
  navigation: NavigationProp<any>
}

interface State {
  seedWords: SeedWordInfo[];
  passphrase: string;
  checksumValid: boolean;
  fingerprint: string;
}

const wordRowHeight = 49.25;

export default class GenerateSeedScreen extends PureComponent<Props, State> {
  static contextType = AccountsContext;

  constructor(props: any) {
    super(props);

    this.state = {
      seedWords: [],
      passphrase: '',
      checksumValid: true,
      fingerprint: ''
    };
  }

  async componentDidMount() {
    navUtils.setHeaderTitle(this.context.currentAccount.name, this.props.navigation);
    
    await this.initSeedWords();
  }

  componentDidUpdate() {
    navUtils.setHeaderTitle(this.context.currentAccount.name, this.props.navigation);
  }

  async initSeedWords() {
    const mnemonic = await this.context.generateMnemonic(this.context.currentAccount.seedWordCount);
    const words = mnemonic.split(' ');

    const seedWords: SeedWordInfo[] = [];
    for (let i = 0; i < words.length; i++) {
      seedWords.push({
        word: words[i],
        index: i,
        valid: true,
        dirty: false
      });
    }

    const fingerprint = await this.context.getFingerprint(mnemonic);

    this.setState({ seedWords, fingerprint });
  }

  getWordComponents(account: Account) {
    const numWords = account?.seedWordCount || 24;
    const words = [];
    for (let i = 0; i < numWords; i++) {
      words.push(
        <WordLabel
          style={styles.word}
          num={i+1}
          key={i}
          seedWord={this.state.seedWords[i]}
        ></WordLabel>
      );
    }
    return words;
  }

  updatePassphrase = async (passphrase: string) => {
    const seedWords = [...this.state.seedWords];
    let fingerprint = '';

    const seedWordsString = this.wordsToString(seedWords);
    const checksumValid = bip39.validateMnemonic(seedWordsString);
    if (checksumValid) {
      const accountsContext = this.context as any;
      fingerprint = await accountsContext.getFingerprint(seedWordsString, passphrase);
    }

    this.setState({passphrase, fingerprint});
  }

  wordsToString(seedWords: SeedWordInfo[]): string {
    return seedWords.map(seedWord => seedWord.word).join(' ');
  }

  private cancel() {
    this.props.navigation.navigate('AccountList');
  }
    
  render() {
    const { checksumValid, fingerprint, passphrase } = this.state;

    return (
      <AccountsContext.Consumer>
        {({currentAccount, setCurrentAccount, loadWalletFromMnemonic, storeAccountWithSnapshot }) => (
          <>
          <KeyboardAvoidingViewWithHeaderOffset
            style={styles.container}
          >
            <View>
              <AppText style={styles.label}>
                Mnemonic Seed Words (BIP39)
              </AppText>
              <View style={[styles.words,
                currentAccount.seedWordCount === SeedWordCount.WORDS12 ? styles.words12 :
                currentAccount.seedWordCount === SeedWordCount.WORDS15 ? styles.words15 :
                currentAccount.seedWordCount === SeedWordCount.WORDS18 ? styles.words18 :
                currentAccount.seedWordCount === SeedWordCount.WORDS21 ? styles.words21 :
                currentAccount.seedWordCount === SeedWordCount.WORDS24 ? styles.words24 : {}
              ]}>
                {this.getWordComponents(currentAccount)}
              </View>
            </View>
            <View style={styles.passphrase}>
              <AppText style={styles.label}>
                Passphrase (optional)
              </AppText>
              <TextInput
                style={styles.passphraseText}
                onChangeText={this.updatePassphrase}
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
                {fingerprint && <View style={styles.fingerprint}>
                  <AppText style={styles.fingerprintLabel}>Fingerprint</AppText>
                  <AppText style={styles.fingerprintValue}>{ fingerprint }</AppText>
                </View>}
              </View>
            </View>
            <View>
              <Button
                title="Confirm Seed"
                style={checksumValid ? styles.submitEnabled : styles.submitDisabled }
                disabled={! checksumValid}
                onPress={async() => {
                  try {
                    setCurrentAccount({
                      ...currentAccount,
                      seedWords: this.state.seedWords.map(sw => sw.word),
                      passphrase
                    });
                    this.props.navigation.navigate('ConfirmWord', { wordNum: 1 });
                  } catch (err) {
                    console.error(err);
                    Alert.alert('Error', '' + err, [{text: 'OK'}]);
                  }
                }}
              ></Button>
              <Button
                title='Cancel'
                onPress={() => this.cancel()}
                style={styles.cancel}
              ></Button>
            </View>
            
            </KeyboardAvoidingViewWithHeaderOffset>
          </>
        )}
      </AccountsContext.Consumer>
    );
  }

}

const styles = StyleSheet.create({
  ...SeedScreenStyles
} as any);
