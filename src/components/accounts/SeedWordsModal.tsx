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

import { SeedWordCount } from '../../enums/SeedWordCount';
import { SeedWordsInfos } from './SeedWordsInfos';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  onClose: (seedWordCount: SeedWordCount | null) => void
}

interface State {
  seedWordCount: SeedWordCount,
  infoExpanded: boolean;
}

export default class SeedWordsModal extends React.PureComponent<Props, State> {
  
  constructor(props: any) {
    super(props);

    this.state = {
      seedWordCount: props.seedWordCount,
      infoExpanded: false
    };
  }

  toggleInfoExpanded() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    this.setState({infoExpanded: ! this.state.infoExpanded});
  }

  updateSeedWords(count: SeedWordCount) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    this.setState({seedWordCount: count});
  }

  render() {
    const { seedWordCount, infoExpanded } = this.state;
    const seedWordsInfo = SeedWordsInfos.get(seedWordCount);

    const buttons = [];
    for (let info of SeedWordsInfos.getAll()) {
      buttons.push(
        <LabeledRadioButton
          title={info.name}
          key={info.seedWordCount}
          value={info.seedWordCount}
          onPress={(value: SeedWordCount) => this.updateSeedWords(value)}
          selected={info.seedWordCount === this.state.seedWordCount}
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
        </ScrollView>
        <View style={styles.actions}>
            <Button
              title='Select'
              onPress={() => this.props.onClose(this.state.seedWordCount)}
              style={styles.defaultActionButton}
            ></Button>
            <Button
              title='Cancel'
              onPress={() => this.props.onClose(null)}
              style={styles.cancelActionButton}
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
    marginBottom: 42
  },
});
