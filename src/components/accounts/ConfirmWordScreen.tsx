import { PureComponent } from 'react';
import {
  View,
  StyleSheet,
  ScrollView
} from 'react-native';

import { NavigationProp, Route } from '@react-navigation/native';

import navUtils from '../../utils/NavUtils';

import { Colors, Layout, Typography } from '../../styles';

import Button from '../shared/Button';
import { AppText } from '../shared/AppText';
import CheckboxGroup from '../shared/CheckboxGroup';

import { AccountsContext } from './AccountsContext';

interface Props {
  navigation: NavigationProp<any>;
  route: Route<any>;
}

interface State {
  selectedWord: string;
  candidateWords: string[];
}

export default class ConfirmWordScreen extends PureComponent<Props, State> {
  static contextType = AccountsContext;

  constructor(props: any) {
    super(props);

    this.state = {
      selectedWord: '',
      candidateWords: []
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
    let currentIndex = array.length,  randomIndex;
  
    // While there remain elements to shuffle.
    while (currentIndex > 0) {
  
      // Pick a remaining element.
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
  
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
  
    return array;
  }

  private next(wordNum: number) {
    this.props.navigation.push('ConfirmWord', { wordNum });
  }

  private onWordChecked(word: string) {
    this.setState({selectedWord: word});
  }
    
  render() {
    const { selectedWord, candidateWords } = this.state;
    const { wordNum } = this.props.route.params;

    return (
      <AccountsContext.Consumer>
        {({ currentAccount }) => (
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
                style={selectedWord ? styles.submitEnabled : styles.submitDisabled }
                disabled={! selectedWord}
                onPress={() => this.next(wordNum + 1)}
              ></Button>
              <Button
                title='Cancel'
                onPress={() => this.cancel()}
                style={styles.cancel}
              ></Button>
            </View>
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
  cancel: {
    backgroundColor: Colors.cancelActionBackground,
    color: Colors.cancelActionText,
    marginBottom: 42
  },
  label: {
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 39,
    ...Typography.capitalization.uppercase
  }
});
