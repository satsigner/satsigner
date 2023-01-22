import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { ScriptVersion } from '../../enums/ScriptVersion';

import LabeledRadioButton from '../shared/LabeledRadioButton';

import { Typography, Layout, Colors } from '../../styles';

interface Props {
}

interface State {
  scriptVersion: ScriptVersion
}

export default class ScriptTypeModal extends React.PureComponent<Props, State> {
  defaultScriptVersion = ScriptVersion.P2WPKH;
  
  constructor(props: any) {
    super(props);

    this.state = {
      scriptVersion: ScriptVersion.P2SH
    };
  }

  render() {
    const buttons = [];
    for (let info of scriptVersionInfos) {
      buttons.push(
        <LabeledRadioButton
          title={`${info.longName} (${info.shortName})`}
          key={info.scriptVersion}
          value={info.scriptVersion}
          onPress={(value: ScriptVersion) => this.setState({scriptVersion: value})}
          selected={info.scriptVersion === this.defaultScriptVersion}
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
  }
});

class ScriptVersionInfo {
  scriptVersion: ScriptVersion;
  shortName: string;
  longName: string;
  description: string;
}

const scriptVersionInfos: ScriptVersionInfo[] = [
  {
    scriptVersion: ScriptVersion.P2PKH,
    shortName: 'P2PKH',
    longName: 'Legacy',
    description: 'To solve this script, the owner of the hashed public key above needs to privide the original public key, along with a valid signature for it.'
  },
  {
    scriptVersion: ScriptVersion.P2SH,
    shortName: 'P2SH',
    longName: 'Nested Segwit',
    description: 'To solve this script, the owner of the hashed public key above needs to privide the original public key, along with a valid signature for it.'  
  },
  {
    scriptVersion: ScriptVersion.P2WPKH,
    shortName: 'P2WPKH',
    longName: 'Native Segwit',
    description: 'To solve this script, the owner of the hashed public key above needs to privide the original public key, along with a valid signature for it.'
  },
  {
    scriptVersion: ScriptVersion.P2TR,
    shortName: 'P2TR',
    longName: 'Taproot',
    description: 'To solve this script, the owner of the hashed public key above needs to privide the original public key, along with a valid signature for it.'
  }
];
