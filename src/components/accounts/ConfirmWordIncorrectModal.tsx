import React from 'react';
import {
  View,
  StyleSheet
} from 'react-native';

import { Typography } from '../../styles';
import ModalDialog from '../shared/ModalDialog';
import { AppText } from '../shared/AppText';

interface Props {
  onClose: () => void
}

interface State {
}

export default class ConfirmWordIncorrectModal extends React.PureComponent<Props, State> {
  
  constructor(props: any) {
    super(props);

    this.state = {
    };
  }

  render() {
    return (
      <ModalDialog
        buttonText='Review and try again'
        onClose={this.props.onClose}
      >
        <View style={styles.container}>
          <AppText style={styles.text}>
            Selected word{"\n"}
            doesn't match the{"\n"}
            original seed
          </AppText>
        </View>
      </ModalDialog> 
    );
  }
}

const styles = StyleSheet.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: 220
  },
  text: {
    ...Typography.textHighlight.x20,
    textAlign: 'center'
  }
});
