import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
  TouchableWithoutFeedback
} from 'react-native';

import LinearGradient from 'react-native-linear-gradient';

import LabeledRadioButton from '../shared/LabeledRadioButton';
import Button from '../shared/Button';

import { Typography, Layout, Colors } from '../../styles';

import { SeedWords } from '../../enums/SeedWords';
import { SeedWordsInfos } from './SeedWordsInfos';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  onClose: (seedWords: SeedWords | null) => void
}

interface State {
  seedWords: SeedWords,
  infoExpanded: boolean;
}

export default class SeedWordsModal extends React.PureComponent<Props, State> {
  
  constructor(props: any) {
    super(props);

    this.state = {
      seedWords: props.seedWords,
      infoExpanded: false
    };
  }

  toggleInfoExpanded() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    this.setState({infoExpanded: ! this.state.infoExpanded});
  }

  updateSeedWords(seedWords: SeedWords) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    this.setState({seedWords});
  }

  render() {
    const { seedWords, infoExpanded } = this.state;
    const seedWordsInfo = SeedWordsInfos.get(seedWords);

    const buttons = [];
    for (let info of SeedWordsInfos.getAll()) {
      buttons.push(
        <LabeledRadioButton
          title={info.name}
          key={info.seedWords}
          value={info.seedWords}
          onPress={(value: SeedWords) => this.updateSeedWords(value)}
          selected={info.seedWords === this.state.seedWords}
        >
        </LabeledRadioButton>
      );
    }

    return (
      <View style={styles.container}>
        <View>
          <Text style={styles.modalTitle}>Mnemonic Seed Words (BIP39)</Text>
          <TouchableWithoutFeedback
            onPress={() => this.toggleInfoExpanded()}
          >
            <View style={styles.infoContainer}>
              <View style={styles.infoHeading}>
                <Text style={styles.infoName}>{seedWordsInfo?.name}</Text>
              </View>
              <View style={infoExpanded ? styles.infoBodyExpanded : styles.infoBodyCollapsed}>
                <Text style={styles.infoDescription}>{seedWordsInfo?.description}</Text>
                <LinearGradient
                  style={infoExpanded ?
                    {...styles.infoDescriptionObscure, ...styles.infoDescriptionReveal } :
                    styles.infoDescriptionObscure }
                  colors={[Colors.transparent, 'rgba(0,0,0,1)']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1.0 }}
                ></LinearGradient>
              </View>
              <View style={{marginTop: 0}}>
                <Text
                  style={styles.infoExpandCollapseAction}
                >{infoExpanded ? 'LESS' : 'MORE'}</Text>
              </View>
            </View>
          </TouchableWithoutFeedback>
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
            onPress={() => this.props.onClose(this.state.seedWords)}
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
  infoName: {
    ...Typography.textHighlight.x5,
    ...Typography.capitalization.uppercase
  },
  infoScriptCode: {
    ...Typography.textHighlight.x5,
    color: Colors.modalTitle
  },
  infoDescription: {
    ...Typography.textHighlight.x9,
    color: Colors.modalTitle    
  },
  infoDescriptionObscure: {
    height: 25,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0
  },
  infoDescriptionReveal: {
    height: 0
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
  infoBodyCollapsed: {
    overflow: 'hidden',
    height: 65,
    position: 'relative'
  },
  infoBodyExpanded: {
    height: 'auto',
    position: 'relative'
  },
  infoExpandCollapseAction: {
    ...Typography.textHighlight.x5,
    ...Typography.capitalization.uppercase
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
