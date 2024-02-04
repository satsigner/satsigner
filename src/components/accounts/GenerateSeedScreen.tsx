import { PureComponent } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator
} from 'react-native';

import { NavigationProp } from '@react-navigation/native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'

import { Typography, Layout, Colors } from '../../styles';
import navUtils from '../../utils/NavUtils';

import { Account } from '../../models/Account';
import Button from '../shared/Button';
import { AppText } from '../shared/AppText';

import { AccountsContext } from './AccountsContext';
import { SeedWords } from '../../enums/SeedWords';
import { SeedWordInfo } from './SeedWordInfo';
import { Word } from './Word';

interface Props {
  navigation: NavigationProp<any>
}

interface State {
  seedWords: SeedWordInfo[];
  passphrase: string;
  loading: boolean;
}

const wordRowHeight = 49.25;

export default class GenerateSeedScreen extends PureComponent<Props, State> {
  static contextType = AccountsContext;

  constructor(props: any) {
    super(props);

    this.state = {
      seedWords: [],
      passphrase: '',
      loading: false
    };
  }

  componentDidMount() {
    navUtils.setHeaderTitle(this.context.currentAccount.name, this.props.navigation);
    
    // this.initSeedWords();
  }

  componentDidUpdate() {
    navUtils.setHeaderTitle(this.context.currentAccount.name, this.props.navigation);
  }

  // initSeedWords() {
  //   const seedWords: SeedWordInfo[] = [];
  //   for (let i = 0; i < this.context.currentAccount.seedWords; i++) {
  //     seedWords.push({
  //       word: '',
  //       index: i,
  //       valid: false,
  //       dirty: false
  //     });
  //   }
  //   this.setState({ seedWords });
  // }

  // getWordComponents(account: Account) {
  //   const numWords = account?.seedWords || 24;
  //   const words = [];
  //   for (let i = 0; i < numWords; i++) {
  //     words.push(
  //       <Word
  //         style={styles.word}
  //         num={i+1}
  //         key={i}
  //         seedWord={this.state.seedWords[i]}
  //         onChangeWord={this.updateWord}
  //         onEndEditingWord={this.updateWordDoneEditing}
  //         onFocusWord={this.focusWord}
  //       ></Word>
  //     );
  //   }
  //   return words;
  // }

  setPassphrase(passphrase: string) {
    this.setState({passphrase});
  }

  setLoading(loading: boolean) {
    this.setState({loading});
  }
    
  render() {
    // const { } = this.state;

    return (
      <AccountsContext.Consumer>
        {({currentAccount, loadWalletFromMnemonic, getAccountSnapshot, storeAccountSnapshot }) => (
          <>
          <KeyboardAwareScrollView
            style={styles.container}
            enableOnAndroid={true}
          >
            <View>
              <AppText style={styles.label}>
                Mnemonic Seed Words (BIP39)
              </AppText>
              {/* <View style={[styles.words,
                currentAccount.seedWords === SeedWords.WORDS12 ? styles.words12 :
                currentAccount.seedWords === SeedWords.WORDS15 ? styles.words15 :
                currentAccount.seedWords === SeedWords.WORDS18 ? styles.words18 :
                currentAccount.seedWords === SeedWords.WORDS21 ? styles.words21 :
                currentAccount.seedWords === SeedWords.WORDS24 ? styles.words24 : {}
              ]}>
                {this.getWordComponents(currentAccount)}
              </View> */}
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
              {/* <View style={styles.passphraseStatus}>
                <View style={styles.fingerprint}>
                  <AppText style={styles.fingerprintLabel}>Fingerprint</AppText>
                  <AppText style={styles.fingerprintValue}>af4261ff</AppText>
                </View>
              </View> */}
            </View>
            <View>
              <Button
                title="Save Secret Seed"
                style={styles.submit }
                onPress={async() => {
                  try {
                    this.setLoading(true);

                    // const mnemonic = this.wordsToString(this.state.seedWords);
                    // console.log('mnemonic', mnemonic);
              
                    // const wallet = await loadWalletFromMnemonic(mnemonic, this.state.passphrase);
              
                    // const snapshot = await getAccountSnapshot(wallet);
                    // await storeAccountSnapshot(snapshot);

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

const styles = StyleSheet.create({  
  container: {
    ...Layout.container.base,
    ...Layout.container.horizontalPadded,
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
  submit: {
    backgroundColor: Colors.defaultActionBackground,
    color: Colors.defaultActionText,
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
