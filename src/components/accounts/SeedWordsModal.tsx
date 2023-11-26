import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager
} from 'react-native';

import LinearGradient from 'react-native-linear-gradient';

import LabeledRadioButton from '../shared/LabeledRadioButton';
import Button from '../shared/Button';
import { AppText } from '../shared/AppText';

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
        <ScrollView>
          <View>
            <AppText style={styles.modalTitle}>Mnemonic Seed Words (BIP39)</AppText>
            <View style={styles.infoContainer}>
              <View style={styles.infoHeading}>
                <AppText style={styles.infoName}>{seedWordsInfo?.name}</AppText>
              </View>
              <View>
                <AppText style={styles.infoDescription}>{seedWordsInfo?.description}</AppText>
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
              onPress={() => this.props.onClose(this.state.seedWords)}
              style={styles.defaultActionButton}
            ></Button>
          </View>
        </ScrollView>
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
  infoName: {
    ...Typography.capitalization.uppercase
  },
  infoDescription: {
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
    marginBottom: 6
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
  },
});
