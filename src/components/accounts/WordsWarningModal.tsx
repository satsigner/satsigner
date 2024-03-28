import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet
} from 'react-native';

import Button from '../shared/Button';
import { AppText } from '../shared/AppText';

import { AccountsContext } from './AccountsContext';

import { Typography, Layout, Colors } from '../../styles';

import HideWarningIcon from '../../assets/images/hide-warning.svg';
import CircleWithCheckIcon from '../../assets/images/circle-check.svg';

interface Props {
  onClose: () => void
}

interface State {
}

export default class WordsWarningModal extends React.PureComponent<Props, State> {
  
  constructor(props: any) {
    super(props);

    this.state = {
    };
  }

  render() {
    // const { } = this.state;
    
    return (
      <AccountsContext.Consumer>
        {({ currentAccount }) => (
          <View style={styles.container}>
            <ScrollView>
              <View style={styles.content}>
                <View style={styles.wordsConfirmed}>
                  <CircleWithCheckIcon width={30} height={27} />
                  <AppText style={styles.wordsConfirmedText}>{currentAccount.seedWordCount} of {currentAccount.seedWordCount}</AppText>
                </View>
                <AppText style={styles.adageCallout}>
                  Not Your Keys,{"\n"}
                  Not Your Coins.
                </AppText>
                <AppText style={styles.warningHeading}>Warning</AppText>
                <HideWarningIcon style={styles.hideWarningIcon} width={210} height={132}></HideWarningIcon>
                <AppText style={styles.warningCallout}>
                  Keep this information{"\n"}
                  secret and backed up.
                </AppText>
                <AppText style={styles.warningText}>
                  Anyone with this information can move the sats to another account.{"\n"}
                  {"\n"}
                  Consider an air-gapped hardware device for generating keys for significant amounts.{"\n"}
                  {"\n"}
                  Losing this information will lose the funds.</AppText>
              </View>
            </ScrollView>
            <View style={styles.actions}>
              <Button
                title='Acknowledge'
                onPress={() => this.props.onClose()}
                style={styles.defaultActionButton}
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
    ...Layout.container.topPadded,
    ...Layout.container.horizontalPadded,
    backgroundColor: Colors.modalBackground
  },
  content: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  wordsConfirmed: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30
  },
  wordsConfirmedText: {
    ...Typography.fontSize.x26,
    ...Typography.fontFamily.sfProTextLight,
    letterSpacing: 3,
    marginLeft: 10
  },
  adageCallout: {
    ...Typography.fontSize.x5,
    ...Typography.capitalization.uppercase,
    ...Typography.fontFamily.sfProDisplayMedium,
    textAlign: 'center',
    marginTop: 46,
    letterSpacing: 1,
    lineHeight: Typography.fontSize.x5.fontSize
  },
  warningHeading: {
    ...Typography.fontSize.x38,
    ...Typography.capitalization.uppercase,
    ...Typography.fontFamily.sfProTextLight,
    marginTop: 0,
    letterSpacing: 3
  },
  hideWarningIcon: {
    marginTop: 10
  },
  warningCallout: {
    ...Typography.fontSize.x18,
    ...Typography.fontFamily.sfProDisplayMedium,
    textAlign: 'center',
    marginTop: 30,
    letterSpacing: 2,
    lineHeight: Typography.fontSize.x28.fontSize
  },
  warningText: {
    ...Typography.fontSize.x11,
    ...Typography.fontFamily.sfProDisplayRegular,
    textAlign: 'center',
    color: Colors.grey132,
    marginTop: 40
  },
  actions: {
    justifyContent: 'space-evenly',
    marginVertical: 20
  },
  defaultActionButton: {
    backgroundColor: Colors.defaultActionBackground,
    color: Colors.defaultActionText
  }
});
