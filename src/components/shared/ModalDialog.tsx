import React from 'react';
import {
  View,
  StyleSheet
} from 'react-native';

import Button from '../shared/Button';

import LinearGradient from 'react-native-linear-gradient';

import { Layout, Colors } from '../../styles';

interface Props {
  children: any;
  onClose: () => void;
  buttonText: string;
}

interface State {
}

export default class ModalDialog extends React.PureComponent<Props, State> {
  
  constructor(props: any) {
    super(props);

    this.state = {
    };
  }

  render() {  
    return (
      <View style={styles.dimmedOverlay}>
        <LinearGradient
          style={styles.dialogBackground}
          colors={[Colors.grey21, Colors.grey47]}
          start={{ x: 1, y: 1 }}
          end={{ x: 0, y: 0 }}
        >
          { this.props.children }

          <Button
            title={this.props?.buttonText || 'Close' }
            onPress={() => this.props.onClose?.()}
            style={styles.closeButton}
          ></Button>
        </LinearGradient>
      </View>        
    );
  }

}

const styles = StyleSheet.create({
  dimmedOverlay: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    ...Layout.container.horizontalPadded
  },
  dialogBackground: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
    width: '100%',
    borderRadius: 3,
  },
  closeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.11)',
    color: Colors.actionText,
    width: '100%',
    marginBottom: 0,
    borderRadius: 0
  },
});
