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
}

export default class ConfirmWordScreen extends PureComponent<Props, State> {
  static contextType = AccountsContext;

  constructor(props: any) {
    super(props);

    this.state = {
      selectedWord: ''
    };
  }

  async componentDidMount() {
    navUtils.setHeaderTitle(this.context.currentAccount.name, this.props.navigation);
  }

  componentDidUpdate() {
    navUtils.setHeaderTitle(this.context.currentAccount.name, this.props.navigation);
  }

  private cancel() {
    this.props.navigation.navigate('AccountList');
  }

  private next(wordNum: number) {
    this.props.navigation.push('ConfirmWord', { wordNum });
  }

  private onWordChecked(word: string) {
    this.setState({selectedWord: word});
  }
    
  render() {
    const { selectedWord } = this.state;
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
                  values={currentAccount.seedWords?.slice(0, 3)}
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
