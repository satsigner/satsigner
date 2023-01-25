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
    const { scriptVersion } = this.state;
    const scriptVersionInfo = ScriptVersionInfos.get(scriptVersion);

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
        <View>
          <Text style={styles.modalTitle}>Script Version</Text>
          <View style={styles.infoContainer}>
            <View style={styles.infoHeading}>
              <Text style={styles.infoScriptVersionName}>{scriptVersionInfo?.longName} ({scriptVersionInfo?.shortName})</Text>
              <Text style={styles.infoScriptCode}>{scriptVersionInfo?.scriptCode}</Text>
            </View>
            <View style={styles.infoBody}>
              <Text style={styles.infoScriptDescription}>{scriptVersionInfo?.description}</Text>
            </View>
          </View>
          <View>
            {buttons}
          </View>
        </View>
        <View style={styles.actions}>
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
    backgroundColor: Colors.modalBackground,
    justifyContent: 'space-between'
  },
  modalTitle: {
    ...Typography.textHighlight.x8,
    color: Colors.modalTitle,
    alignSelf: 'center',
    marginBottom: 28
  },
  infoScriptVersionName: {
    ...Typography.textHighlight.x5,
    ...Typography.capitalization.uppercase
  },
  infoScriptCode: {
    ...Typography.textHighlight.x5,
    color: Colors.modalTitle
  },
  infoScriptDescription: {
    ...Typography.textHighlight.x8,
    color: Colors.modalTitle    
  },
  infoContainer: {
    flexDirection: 'column',
    marginBottom: 28
  },
  infoHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  infoBody: {

  },
  actions: {
    justifyContent: 'space-evenly',
    marginVertical: 30
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
