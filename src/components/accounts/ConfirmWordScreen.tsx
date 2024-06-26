import { PureComponent } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Modal
} from 'react-native';

import { NavigationProp, Route } from '@react-navigation/native';

import navUtils from '../../utils/NavUtils';

import { Colors, Layout, Typography } from '../../styles';

import Button from '../shared/Button';
import { AppText } from '../shared/AppText';
import CheckboxGroup from '../shared/CheckboxGroup';

import { AccountsContext } from './AccountsContext';

import ConfirmWordIncorrectModal from './ConfirmWordIncorrectModal';

import { ScriptVersion } from '../../enums/ScriptVersion';
import { AccountSummary } from '../../models/Account';
import WordsWarningModal from './WordsWarningModal';

interface Props {
  navigation: NavigationProp<any>;
  route: Route<any>;
}

interface State {
  selectedWord: string;
  candidateWords: string[];
  confirmWordIncorrectModalVisible: boolean;
  wordsWarningModalVisible: boolean;
  disabled: boolean;
}

export default class ConfirmWordScreen extends PureComponent<Props, State> {
  static contextType = AccountsContext;

  constructor(props: any) {
    super(props);

    this.state = {
      selectedWord: '',
      candidateWords: [],
      confirmWordIncorrectModalVisible: false,
      wordsWarningModalVisible: false,
      disabled: false
    };
  }

  async componentDidMount() {
    navUtils.setHeaderTitle(this.context.currentAccount.name, this.props.navigation);
    this.setState({ candidateWords: this.getCandidateWords() });
  }

  componentDidUpdate() {
    navUtils.setHeaderTitle(this.context.currentAccount.name, this.props.navigation);
  }

  private cancel() {
    this.props.navigation.navigate('AccountList');
  }

  private getCandidateWords(): string[] {
    const { wordNum } = this.props.route.params;
    const { seedWords } = this.context.currentAccount;
    const candidates = [];
    
    const target = seedWords[wordNum - 1];
    candidates.push(target);

    while (candidates.length < 3) {
      const newCandidate = seedWords[Math.floor(Math.random() * seedWords.length)];
      if (! candidates.includes(newCandidate)) {
        candidates.push(newCandidate);
      }
    }
        
    this.shuffle(candidates);

    return candidates;
  }

  private shuffle(array: string[]) {
    let currentIndex = array.length
    let randomIndex;
  
    // While there remain elements to shuffle.
    while (currentIndex > 0) {
  
      // Pick a remaining element.
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
  
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] =
        [array[randomIndex], array[currentIndex]];
    }
  
    return array;
  }

  private async next(wordNum: number) {
    const { seedWords } = this.context.currentAccount;
    const target = seedWords[wordNum - 1];

    if (this.state.selectedWord === target) {
      if (this.context.currentAccount.seedWordCount === wordNum) {
        // we've confirmed the last word, show warning dialog
        this.setState({wordsWarningModalVisible: true});
      } else {
        // continue with the next word
        this.props.navigation.push('ConfirmWord', { wordNum: wordNum + 1 });
      }
    } else {
      // wrong word was selected, show the incorrect word dialog
      this.setState({confirmWordIncorrectModalVisible: true});
    }
  }

  private getSeedWordsString(): string {
    return this.context.currentAccount.seedWords.join(' ');
  }

  private onWordChecked(word: string) {
    this.setState({selectedWord: word});
  }
    
  render() {
    const { selectedWord, candidateWords, confirmWordIncorrectModalVisible, wordsWarningModalVisible, disabled } = this.state;
    const { wordNum } = this.props.route.params;

    return (
      <AccountsContext.Consumer>
        {({ currentAccount, loadWalletFromMnemonic, storeAccount, populateWalletData }) => (
          <View style={styles.container}>
            <ScrollView>
              <View>
                <AppText style={styles.label}>
                  Confirm Word { wordNum }
                </AppText>
                <CheckboxGroup
                  values={candidateWords}
                  onChecked={this.onWordChecked.bind(this)}
                ></CheckboxGroup>
              </View>
            </ScrollView>

            <View>
              <Button
                title="Next"
                style={! selectedWord || disabled ? styles.submitDisabled : styles.submitEnabled }
                disabled={! selectedWord || disabled}
                onPress={async() => await this.next(wordNum)}
              ></Button>
              <Button
                title='Cancel'
                onPress={() => this.cancel()}
                style={disabled ? styles.cancelDisabled : styles.cancelEnabled}
                disabled={disabled}
              ></Button>
            </View>

            <Modal
              visible={confirmWordIncorrectModalVisible}
              transparent={true}
              animationType='fade'
              onShow={async() => { }}
            >
              <ConfirmWordIncorrectModal
                onClose={() => {
                  this.setState({ confirmWordIncorrectModalVisible: false });
                }}
              ></ConfirmWordIncorrectModal>
            </Modal>

            <Modal
              visible={wordsWarningModalVisible}
              transparent={false}
            >
              <WordsWarningModal
                onClose={async() => {
                  
                  this.setState({
                    wordsWarningModalVisible: false,
                    disabled: true
                  });

                  // warning acknowledged, store new seed
                  const mnemonic = this.getSeedWordsString();
                  console.log('mnemonic', mnemonic);
            
                  const wallet = await loadWalletFromMnemonic(
                    mnemonic,
                    currentAccount.passphrase as string,
                    currentAccount.scriptVersion as ScriptVersion
                  );
            
                  // this is a new random seed, assuming it has never been used
                  // skip sync and store
                  await populateWalletData(null, currentAccount);
                  await storeAccount(currentAccount);

                  this.props.navigation.reset({
                    index: 0,
                    routes: [{ name: 'AccountList' }],
                  });
                }}
              ></WordsWarningModal>
            </Modal>
          </View>
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
  submitEnabled: {
    backgroundColor: Colors.defaultActionBackground,
    color: Colors.defaultActionText,
  },
  submitDisabled: {
    backgroundColor: Colors.disabledActionBackground,
    color: Colors.disabledActionText
  },
  cancelEnabled: {
    backgroundColor: Colors.cancelActionBackground,
    color: Colors.cancelActionText,
    marginBottom: 42
  },
  cancelDisabled: {
    backgroundColor: Colors.cancelActionBackground,
    color: Colors.disabledCancelActionText,
    marginBottom: 42
  },
  label: {
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 39,
    ...Typography.capitalization.uppercase
  }
});
