import { PureComponent, useRef, useEffect, useState } from 'react';
import {
  Animated,
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  Keyboard,
  TouchableOpacity
} from 'react-native';

import { NavigationProp } from '@react-navigation/native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'

import * as bip39 from 'bip39';

import { Typography, Layout, Colors } from '../../styles';
import navUtils from '../../utils/NavUtils';

import { Account } from '../../models/Account';
import Button from '../shared/Button';
import { AppText } from '../shared/AppText';

import { AccountsContext } from './AccountsContext';
import { SeedWords } from '../../enums/SeedWords';

interface Props {
  navigation: NavigationProp<any>
}

interface State {
  seedWords: SeedWord[];
  passphrase: string;
  checksumValid: boolean;
  loading: boolean;
  showWordSelector: boolean;
  currentWordText: string;
  currentWordIndex: number;
}

function getWordList() {
  const name = bip39.getDefaultWordlist();
  return bip39.wordlists[name];
}

class SeedWord {
  word: string;
  // index of this word (out of the 12/15/18/21/24 words)
  index: number;
  valid: boolean;
  dirty: boolean;
}

export default class ImportSeedScreen extends PureComponent<Props, State> {
  static contextType = AccountsContext;

  wordList = getWordList();

  constructor(props: any) {
    super(props);

    this.state = {
      seedWords: [],
      passphrase: '',
      checksumValid: false,
      loading: false,
      showWordSelector: false,
      currentWordText: '',
      currentWordIndex: 0
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
    const seedWords: SeedWord[] = [];
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
          num={i+1}
          key={i}
          inputStyle={
            this.state.seedWords[i]?.valid || ! this.state.seedWords[i]?.dirty ?
              styles.wordText :
              [ styles.wordText, styles.wordTextInvalid ]
          }
          onChangeWord={this.updateWord}
          onEndEditingWord={this.updateWordDoneEditing}
          onFocusWord={this.focusWord}
        ></Word>
      );
    }
    return words;
  }

  updateWord = (word: string, index: number) => {
    const seedWords = [...this.state.seedWords];
    const seedWord = seedWords[index];
    let showWordSelector = false;

    seedWord.word = word;

    const checksumValid = bip39.validateMnemonic(this.wordsToString(seedWords));

    // only update words validity while typing in the field if just made word valid
    // so that we aren't highlighting words as invalid while user is typing
    if (this.wordList.includes(word)) {
      seedWord.valid = true;
    } else {
      showWordSelector = word.length >= 2;
    }

    console.log('showWordSelector', showWordSelector);

    this.setState({
      seedWords,
      checksumValid,
      showWordSelector,
      currentWordText: word
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

    const showWordSelector = ! seedWord.valid && word?.length >= 2;
    this.setState( { showWordSelector, currentWordIndex: index });
  }

  wordsToString(words: SeedWord[]): string {
    return words.map(sw => sw.word).join(' ');
  }

  setPassphrase(passphrase: string) {
    this.setState({passphrase});
  }

  setLoading(loading: boolean) {
    this.setState({loading});
  }

  // TEMP hardcode
  satsToUsd(sats: number) {
    return sats / 100_000_000 * 40_000;
  }
    
  render() {
    const { checksumValid, showWordSelector, currentWordText, currentWordIndex, seedWords } = this.state;

    return (
      <AccountsContext.Consumer>
        {({currentAccount, loadWalletFromMnemonic, getAccountSnapshot, storeAccountSnapshot }) => (
          <>
          <WordSelector
            open={showWordSelector}
            wordStart={currentWordText}
            onWordSelected={(word: string) => {
              // const currentSeedWord = seedWords[currentWordIndex];
              // console.log('currentSeedWord', currentSeedWord, 'word', word);
              // currentSeedWord.word = word;
            }}
          ></WordSelector>

          <KeyboardAwareScrollView
            style={styles.container}
            enableOnAndroid={true}
            extraScrollHeight={60}
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
                style={checksumValid ? styles.submitEnabled : styles.submitDisabled }
                disabled={! checksumValid}
                onPress={async() => {
                  try {
                    this.setLoading(true);

                    const mnemonic = this.wordsToString(this.state.seedWords);
                    console.log('mnemonic', mnemonic);
              
                    const wallet = await loadWalletFromMnemonic(mnemonic, this.state.passphrase);
                    this.setState({checksumValid: true});
              
                    const snapshot = await getAccountSnapshot(wallet);
                    await storeAccountSnapshot(snapshot);

                    this.props.navigation.navigate('AccountList');
                  } catch (err) {
                    console.error(err);
                    Alert.alert('Error', '' + err, [{text: 'OK'}]);
                  } finally {
                    this.setLoading(false);
                  }
                }}
              ></Button>
            </View>
            
            {this.state.loading &&
            <ActivityIndicator
              size="large"
              style={styles.loading}>
            </ActivityIndicator>
            }
          </KeyboardAwareScrollView>
          </>
        )}
      </AccountsContext.Consumer>
    );
  }

}

function Word(props: any) {
  return (
    <View style={styles.word}>
      <TextInput
        style={props.inputStyle}
        onChangeText={(word) => props.onChangeWord(word, props.num - 1)}
        onEndEditing={(event) => props.onEndEditingWord(event.nativeEvent.text, props.num - 1) }
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect={false}
        spellCheck={false}
      ></TextInput>
      <AppText style={styles.wordNumLabel}>{props.num}</AppText>
    </View>
  );
}

function usePrevious(value: any) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value; //assign the value of ref to the argument
  },[value]); //this code will run when the value of 'value' changes
  return ref.current; //in the end, return the current ref value.
}

function WordSelector({ open, wordStart, onWordSelected }) {
  const { width, height } = useWindowDimensions();
  const [ keyboardOpen, setKeyboardOpen ] = useState(false);
  const [ keyboardHeight, setKeyboardHeight ] = useState(0);
  const flatList = useRef<FlatList>(null);

  console.log('window', width, 'x', height);
  console.log('keyboardOpen', keyboardOpen);

  const previousOpen = usePrevious(open);
  const previousWordStart = usePrevious(wordStart);

  const opacityAnimated = useRef(new Animated.Value(0)).current;

  let index = 0;

  const wordListData = getWordList()
    .map(w => ({ index: index++, word: w }))
    .filter(w => w.word.indexOf(wordStart) === 0);

  if (wordListData.length > 0 && previousWordStart !== wordStart) {
    flatList.current?.scrollToIndex({index: 0, animated: false});
  }

  // if (keyboardOpen && (open && ! previousOpen)) {
  if (keyboardOpen && open && wordListData.length > 0) {
      Animated.timing(opacityAnimated, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }

  // if (! keyboardOpen || (! open && previousOpen)) {
  if (! keyboardOpen || ! open) {
      Animated.timing(opacityAnimated, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }

  const separator = () => {
    return <View style={{height: '100%', backgroundColor: Colors.grey240, width: 1 }} />;
  };

  useEffect(() => {
    Keyboard.addListener('keyboardDidShow', () => {
      const metrics = Keyboard.metrics();
      const keyboardHeight = metrics?.height || 0;
      console.log('metrics', Keyboard.metrics());
      setKeyboardOpen(true);
      setKeyboardHeight(keyboardHeight);
    });

    Keyboard.addListener('keyboardDidHide', () => {
      const metrics = Keyboard.metrics();
      const keyboardHeight = metrics?.height || 0;
      console.log('metrics', Keyboard.metrics());
      setKeyboardOpen(false);
      setKeyboardHeight(keyboardHeight);
    });
  });

  return (
    <Animated.View style={{
      ...styles.wordSelector,
      bottom: keyboardHeight,
      width,
      opacity: opacityAnimated
    }}>
      <FlatList
        ref={flatList}
        keyboardShouldPersistTaps='handled'
        contentContainerStyle={{
          paddingLeft: 10
        }}
        horizontal={true}
        ItemSeparatorComponent={separator}
        data={wordListData}
        renderItem={({item, index, separators}) => (
          <TouchableOpacity
            key={item.index}
            onPress={() => {
              onWordSelected(item.word);
              console.log('Pressed', item.word);
            }}
          >
            <View style={{paddingHorizontal: 20, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
              <Text style={{...Typography.textNormal.x8, color: Colors.black, letterSpacing: 1}}>{item.word}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </Animated.View>
  );
}

const wordRowHeight = 49.25;

const styles = StyleSheet.create({  
  container: {
    ...Layout.container.base,
    ...Layout.container.horizontalPadded,
    ...Layout.container.topPadded,
  },
  wordSelector: {
    position: 'absolute',
    height: 60,
    backgroundColor: Colors.white,
    color: Colors.black,
    zIndex: 1
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
  wordTextInvalid: {
    borderWidth: 2,
    borderColor: Colors.invalid
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
  },
  loading: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0.5,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center'
  }
});
