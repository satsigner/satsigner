import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet
} from 'react-native';

import Button from '../shared/Button';
import { AppText } from '../shared/AppText';

import LinearGradient from 'react-native-linear-gradient';

import { Typography, Layout, Colors } from '../../styles';

interface Props {
  onClose: () => void
}

interface State {
}

export default class AccountAddedModal extends React.PureComponent<Props, State> {
  
  constructor(props: any) {
    super(props);

    this.state = {
    };
  }

  render() {
    // const { } = this.state;

    return (
      <View style={styles.container}>
        <ScrollView>
          <View>
            <AppText style={styles.modalTitle}>Mnemonic Seed Words (BIP39)</AppText>
          </View>
          <View style={styles.actions}>
            <Button
              title='Cancel'
              onPress={() => this.props.onClose()}
              style={styles.cancelActionButton}
            ></Button>
          </View>
        </ScrollView>
      </View>
    );
  }

}

const styles = StyleSheet.create({  
  container: {
    ...Layout.container.base,
    ...Layout.container.topPadded,
    ...Layout.container.horizontalPadded,
    backgroundColor: Colors.modalBackground,
    justifyContent: 'space-between'
  },
  modalTitle: {
    ...Typography.textHighlight.x8,
    color: Colors.modalTitle,
    alignSelf: 'center',
    marginBottom: 25
  },
  actions: {
    justifyContent: 'space-evenly',
    marginVertical: 10
  },
  cancelActionButton: {
    backgroundColor: Colors.cancelActionBackground,
    color: Colors.cancelActionText,
  },
});
