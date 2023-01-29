import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Modal
} from 'react-native';
import { NavigationProp } from '@react-navigation/native';

import { Typography, Layout, Colors } from '../../styles';

import Button from '../shared/Button';
import SelectButton from '../shared/SelectButton';

import ScriptVersionModal from './ScriptVersionModal';
import { ScriptVersion } from '../../enums/ScriptVersion';
import { ScriptVersionInfos } from './ScriptVersionInfos';

import SeedWordsModal from './SeedWordsModal';
import { SeedWords } from '../../enums/SeedWords';
import { SeedWordsInfos } from './SeedWordsInfos';

interface Props {
  navigation: NavigationProp<any>
}

interface State {
  // Policy Type

  scriptVersion: ScriptVersion,
  scriptVersionName: string,
  scriptVersionModalVisible: boolean,

  seedWords: SeedWords,
  seedWordsName: string,
  seedWordsModalVisible: boolean,
}

export default class AccountOptionsScreen extends React.PureComponent<Props, State> {
  constructor(props: any) {
    super(props);

    this.state = {
      scriptVersion: ScriptVersion.P2WPKH,
      scriptVersionName: ScriptVersionInfos.getName(ScriptVersion.P2WPKH),
      scriptVersionModalVisible: false,

      seedWords: SeedWords.WORDS24,
      seedWordsName: SeedWordsInfos.getName(SeedWords.WORDS24),
      seedWordsModalVisible: false
    };
  }

  render() {
    const {
      scriptVersion,
      scriptVersionName,
      scriptVersionModalVisible,
      seedWords,
      seedWordsName,
      seedWordsModalVisible
    } = this.state;
    
    return (
      <View style={styles.container}>
        <View style={styles.options}>
          <View style={styles.option}>
            <Text style={styles.label}>
              Policy Type
            </Text>
            <SelectButton
              title="Single Signature"
            >
            </SelectButton>
          </View>
          <View style={styles.option}>
            <Text style={styles.label}>
              Script Version
            </Text>
            <SelectButton
              title={scriptVersionName}
              onPress={() => this.setState({scriptVersionModalVisible: true})}
            >
            </SelectButton>
          </View>
          <View style={styles.option}>
            <Text style={styles.label}>
              Mnemonic Seed Words (BIP39)
            </Text>
            <SelectButton
              title={seedWordsName}
              onPress={() => this.setState({seedWordsModalVisible: true})}
            >
            </SelectButton>
          </View>
        </View>
        <View style={styles.actions}>
          <Button
            title='Generate New Secret Seed'
            onPress={() => this.notImplementedAlert()}
            style={styles.defaultActionButton}
          ></Button>
          <Button
            title='Import Existing Seed'
            onPress={() => this.props.navigation.navigate('ImportSeed')}
            style={styles.additionalActionButton}
          ></Button>
          <Button
            title='Import As Stateless'
            onPress={() => this.notImplementedAlert()}
            style={styles.additionalActionButton}
          ></Button>
        </View>
        <Modal
          visible={scriptVersionModalVisible}
          transparent={false}
        >
          <ScriptVersionModal
            onClose={(scriptVersion: ScriptVersion) => this.setScriptVersion(scriptVersion)}
            scriptVersion={scriptVersion}
          ></ScriptVersionModal>
        </Modal>
        <Modal
          visible={seedWordsModalVisible}
          transparent={false}
        >
          <SeedWordsModal
            onClose={(seedWords: SeedWords) => this.setSeedWords(seedWords)}
            seedWords={seedWords}
          ></SeedWordsModal>
        </Modal>
      </View>
    );

  }

  private setScriptVersion(scriptVersion: ScriptVersion | null) {
    if (scriptVersion) {
      const scriptVersionName = ScriptVersionInfos.getName(scriptVersion);
      this.setState({
        scriptVersion,
        scriptVersionName,
        scriptVersionModalVisible: false
      });
    } else {
      this.setState({scriptVersionModalVisible: false});
    }
  }

  private setSeedWords(seedWords: SeedWords | null) {
    if (seedWords) {
      const seedWordsName = SeedWordsInfos.getName(seedWords);
      this.setState({
        seedWords,
        seedWordsName,
        seedWordsModalVisible: false
      });
    } else {
      this.setState({seedWordsModalVisible: false});
    }
  }

  notImplementedAlert() {
    Alert.alert(
      'Coming Soon...',
      'Not yet implemented.',
      [{text: 'OK'}]
    );
  }
}

const styles = StyleSheet.create({  
  container: {
    ...Layout.container.base,
    ...Layout.container.topPadded,
    ...Layout.container.horizontalPadded
  },
  label: {
    ...Typography.textHighlight.x5,
    alignSelf: 'center',
    marginBottom: 0
  },
  defaultActionButton: {
    backgroundColor: Colors.defaultActionBackground,
    color: Colors.defaultActionText
  },
  additionalActionButton: {
    backgroundColor: Colors.additionalActionBackground,
    color: Colors.additionalActionText,
    borderColor: Colors.additionalActionBorder
  },
  options: {
  },
  option: {
    marginBottom: 6
  },
  actions: {
    justifyContent: 'space-evenly',
    marginVertical: 2
  },
});
