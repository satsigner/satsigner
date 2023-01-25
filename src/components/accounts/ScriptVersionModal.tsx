import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';

import LabeledRadioButton from '../shared/LabeledRadioButton';
import Button from '../shared/Button';

import { Typography, Layout, Colors } from '../../styles';

import { ScriptVersion } from '../../enums/ScriptVersion';
import { ScriptVersionInfos } from './ScriptVersionInfos';

interface Props {
  onClose: (scriptVersion: ScriptVersion | null) => void
}

interface State {
  scriptVersion: ScriptVersion
}

export default class ScriptVersionModal extends React.PureComponent<Props, State> {
  defaultScriptVersion = ScriptVersion.P2WPKH;
  
  constructor(props: any) {
    super(props);

    this.state = {
      scriptVersion: props.scriptVersion || this.defaultScriptVersion
    };
  }

  render() {
    const buttons = [];
    for (let info of ScriptVersionInfos.getAll()) {
      buttons.push(
        <LabeledRadioButton
          title={`${info.longName} (${info.shortName})`}
          key={info.scriptVersion}
          value={info.scriptVersion}
          onPress={(value: ScriptVersion) => this.setState({scriptVersion: value})}
          selected={info.scriptVersion === this.state.scriptVersion}
        >
        </LabeledRadioButton>
      );
    }

    return (
      <View style={styles.container}>
        <Text style={styles.label}>Script Version</Text>
        <View>
          {buttons}
        </View>
        <View>
          <Button
            title='Cancel'
            onPress={() => this.props.onClose(null)}
            style={styles.cancelActionButton}
          ></Button>
          <Button
            title='Select'
            onPress={() => this.props.onClose(this.state.scriptVersion)}
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
    backgroundColor: Colors.modalBackground
  },
  label: {
    ...Typography.textHighlight.x8,
    color: Colors.modalTitle,
    alignSelf: 'center',
    marginBottom: 0
  },
  actions: {
    justifyContent: 'space-evenly',
    marginVertical: 2
  },
  defaultActionButton: {
    backgroundColor: Colors.defaultActionBackground,
    color: Colors.defaultActionText
  },
  cancelActionButton: {
    backgroundColor: Colors.cancelActionBackground,
    color: Colors.cancelActionText,
  },
});
