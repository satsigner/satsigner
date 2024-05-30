import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
} from 'react-native';

import { Typography, Layout, Colors } from '../../../styles';
import { Output } from '../../../models/Output';
import { AppText } from '../../../components/shared/AppText';
import Button from '../../../components/shared/Button';

interface Props {
  onClose: (output?: Output) => void
}

export default function AddOutputModal({
  onClose
}: Props) {
  
  return (
    <View style={styles.container}>
      <ScrollView>
        <View>
          <AppText style={styles.modalTitle}>Add Output</AppText>
        </View>
      </ScrollView>
      <View style={styles.actions}>
        <Button
          title='Add'
          onPress={() => onClose({value: 1})}
          style={styles.defaultActionButton}
        ></Button>
        <Button
          title='Cancel'
          onPress={() => onClose()}
          style={styles.cancelActionButton}
        ></Button>
      </View>
    </View>
  );
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
  },
  cancelActionButton: {
    backgroundColor: Colors.cancelActionBackground,
    color: Colors.cancelActionText,
    marginBottom: 42
  }
});
