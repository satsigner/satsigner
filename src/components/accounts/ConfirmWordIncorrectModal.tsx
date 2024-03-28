import React from 'react';
import {
  View,
  StyleSheet,
  Dimensions
} from 'react-native';

import { Typography } from '../../styles';
import ModalDialog from '../shared/ModalDialog';
import { AppText } from '../shared/AppText';

import CircleWithXIcon from '../../assets/images/circle-x.svg';

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
          <CircleWithXIcon style={styles.icon} width={88} height={88}></CircleWithXIcon>
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
    alignItems: 'center'
  },
  icon: {
    marginVertical: 30
  },
  text: {
    ...Typography.textHighlight.x20,
    textAlign: 'center',
    marginBottom: 62
  }
});
