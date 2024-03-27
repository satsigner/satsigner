import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet
} from 'react-native';

import Button from '../shared/Button';
import { AppText } from '../shared/AppText';

import { Typography, Layout, Colors } from '../../styles';

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
      <View style={styles.container}>
        <ScrollView>
          <View>
            <AppText style={styles.modalTitle}>Warning</AppText>
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
  defaultActionButton: {
    backgroundColor: Colors.defaultActionBackground,
    color: Colors.defaultActionText
  }
});
