import { PureComponent } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal
} from 'react-native';

import { Wallet } from 'bdk-rn';

import { NavigationProp } from '@react-navigation/native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'

import * as bip39 from 'bip39';

import { Typography, Layout, Colors } from '../../styles';
import navUtils from '../../utils/NavUtils';

import { Account } from '../../models/Account';
import Button from '../shared/Button';
import { AppText } from '../shared/AppText';

import getWordList from '../shared/getWordList';

import { AccountsContext } from './AccountsContext';
import { SeedWords } from '../../enums/SeedWords';
import { SeedWordInfo } from './SeedWordInfo';
import { Word } from './Word';
import { WordSelector } from './WordSelector';
import AccountAddedModal from './AccountAddedModal';

interface Props {
  navigation: NavigationProp<any>
}

interface State {
  seedWords: SeedWordInfo[];
  passphrase: string;
  checksumValid: boolean;
  showWordSelector: boolean;
  currentWordText: string;
  currentWordIndex: number;
  accountAddedModalVisible: boolean;
  fingerprint: string;
  wallet: Wallet;
}

const wordRowHeight = 49.25;
const wordSelectorHeight = 60;

export default class ImportSeedScreen extends PureComponent<Props, State> {
  static contextType = AccountsContext;

  wordList = getWordList();

  minLettersToShowSelector = 2;

  constructor(props: any) {
    super(props);

    this.state = {
      seedWords: [],
      passphrase: '',
      checksumValid: false,
      showWordSelector: false,
      currentWordText: '',
      currentWordIndex: 0,
      accountAddedModalVisible: false,
      fingerprint: '',
      wallet: null
    };
  }

  componentDidMount() {
    navUtils.setHeaderTitle(this.context.currentAccount.name, this.props.navigation);
    
    this.initSeedWords();
  }

  componentDidUpdate() {
    navUtils.setHeaderTitle(this.context.currentAccount.name, this.props.navigation);
  }

  initSeedWords() {
    const seedWords: SeedWordInfo[] = [];
    for (let i = 0; i < this.context.currentAccount.seedWords; i++) {
      seedWords.push({
        word: '',
        index: i,
        valid: false,
        dirty: false
      });
    }
    this.setState({ seedWords });
  }

  getWordComponents(account: Account) {
    const numWords = account?.seedWords || 24;
    const words = [];
    for (let i = 0; i < numWords; i++) {
      words.push(
        <Word
          style={styles.word}
          num={i+1}
          key={i}
          seedWord={this.state.seedWords[i]}
          onChangeWord={this.updateWord}
          onEndEditingWord={this.updateWordDoneEditing}
          onFocusWord={this.focusWord}
        ></Word>
      );
    }
    return words;
  }

  updateWord = async(word: string, index: number) => {
    const seedWords = [...this.state.seedWords];
    const seedWord = seedWords[index];
    let showWordSelector = false;
    let fingerprint = '';

    seedWord.word = word;

    const seedWordsString = this.wordsToString(seedWords);
    const checksumValid = bip39.validateMnemonic(seedWordsString);
    if (checksumValid) {
      const accountsContext = this.context as any;
      fingerprint = await accountsContext.getFingerprint(seedWordsString, this.state.passphrase);
    }

    // only update words validity while typing in the field if just made word valid
    // so that we aren't highlighting words as invalid while user is typing
    if (this.wordList.includes(word)) {
      seedWord.valid = true;
    } else {
      // show selector once two letters have been entered
      showWordSelector = word.length >= this.minLettersToShowSelector;
    }

    this.setState({
      seedWords,
      checksumValid,
      showWordSelector,
      currentWordText: word,
      fingerprint
    });
  }

  updateWordDoneEditing = (word: string, index: number) => {
    const seedWords = [...this.state.seedWords];
    const seedWord = seedWords[index];

    seedWord.word = word;
    seedWord.valid = this.wordList.includes(word);
    // mark word dirty when done editing the first time
    seedWord.dirty ||= word.length > 0;

    this.setState({ seedWords, currentWordText: word });
  }

  focusWord = (word: string, index: number) => {
    const seedWords = [...this.state.seedWords];
    const seedWord = seedWords[index];

    const currentWordText = word;
    const showWordSelector = ! seedWord.valid && word?.length >= this.minLettersToShowSelector;
    this.setState( { showWordSelector, currentWordIndex: index, currentWordText });
  }

  wordSelected = async(word: string) => {
    const { showWordSelector, currentWordIndex } = this.state;
    const seedWords = [...this.state.seedWords];
    let fingerprint = '';
    
    let show = showWordSelector;
    seedWords[currentWordIndex].word = word;
    if (this.wordList.includes(word)) {
      seedWords[currentWordIndex].valid = true;
      show = false;
    }

    const seedWordsString = this.wordsToString(seedWords);
    const checksumValid = bip39.validateMnemonic(seedWordsString);
    if (checksumValid) {
      const accountsContext = this.context as any;
      fingerprint = await accountsContext.getFingerprint(seedWordsString, this.state.passphrase);
    }

    this.setState({seedWords, checksumValid, showWordSelector: show, fingerprint});
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

  // TEMP hardcode
  satsToUsd(sats: number) {
    return sats / 100_000_000 * 40_000;
  }
    
  render() {
    const { checksumValid, showWordSelector, currentWordText, accountAddedModalVisible, fingerprint, wallet } = this.state;

    return (
      <AccountsContext.Consumer>
        {({currentAccount, loadWalletFromMnemonic, getAccountSnapshot, storeAccountWithSnapshot, syncWallet }) => (
          <>
          <WordSelector
            show={showWordSelector}
            style={styles.wordSelector}
            wordStart={currentWordText}
            onWordSelected={this.wordSelected}
          ></WordSelector>

          <KeyboardAwareScrollView
            style={styles.container}
            enableOnAndroid={true}
            extraScrollHeight={wordSelectorHeight}
          >
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
                title="Save Secret Seed"
                style={checksumValid ? styles.submitEnabled : styles.submitDisabled }
                disabled={! checksumValid}
                onPress={async() => {
                  try {
                    const mnemonic = this.wordsToString(this.state.seedWords);
                    console.log('mnemonic', mnemonic);
              
                    const wallet = await loadWalletFromMnemonic(mnemonic, this.state.passphrase);
              
                    this.setState({
                      accountAddedModalVisible: true,
                      wallet
                    });

                  } catch (err) {
                    console.error(err);
                    Alert.alert('Error', '' + err, [{text: 'OK'}]);
                  }
                }}
              ></Button>
            </View>
            
            <Modal
              visible={accountAddedModalVisible}
              transparent={true}
              animationType='fade'
              onShow={async() => {
                await syncWallet(wallet);

                const snapshot = await getAccountSnapshot(wallet);
                await storeAccountWithSnapshot(snapshot);
              }}
            >
              <AccountAddedModal
                onClose={() => {
                  this.setState({ accountAddedModalVisible: false });
                  this.props.navigation.navigate('AccountList');
                }}
              ></AccountAddedModal>
            </Modal>
          </KeyboardAwareScrollView>
          </>
        )}
      </AccountsContext.Consumer>
    );
  }

}

const styles = StyleSheet.create({  
  container: {
    ...Layout.container.base,
    ...Layout.container.horizontalPadded,
    ...Layout.container.topPadded,
  },
  wordSelector: {
    height: wordSelectorHeight
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
  submitEnabled: {
    backgroundColor: Colors.defaultActionBackground,
    color: Colors.defaultActionText,
  },
  submitDisabled: {
    backgroundColor: Colors.disabledActionBackground,
    color: Colors.disabledActionText
  }
});
