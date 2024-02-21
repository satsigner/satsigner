import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
  TouchableWithoutFeedback
} from 'react-native';

import LinearGradient from 'react-native-linear-gradient';

import LabeledRadioButton from '../shared/LabeledRadioButton';
import Button from '../shared/Button';
import { AppText } from '../shared/AppText';

import { Typography, Layout, Colors } from '../../styles';

import { ScriptVersion } from '../../enums/ScriptVersion';
import { ScriptVersionInfos } from './ScriptVersionInfos';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  onClose: (scriptVersion: ScriptVersion | null) => void
}

interface State {
  scriptVersion: ScriptVersion,
  infoExpanded: boolean;
}

export default class ScriptVersionModal extends React.PureComponent<Props, State> {
  
  constructor(props: any) {
    super(props);

    this.state = {
      scriptVersion: props.scriptVersion,
      infoExpanded: false
    };
  }

  toggleInfoExpanded() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    this.setState({infoExpanded: ! this.state.infoExpanded});
  }

  updateScriptVersion(scriptVersion: ScriptVersion) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    this.setState({scriptVersion});
  }

  render() {
    const { scriptVersion, infoExpanded } = this.state;
    const scriptVersionInfo = ScriptVersionInfos.get(scriptVersion);

    const buttons = [];
    for (let info of ScriptVersionInfos.getAll()) {
      buttons.push(
        <LabeledRadioButton
          title={`${info.longName} (${info.shortName})`}
          key={info.scriptVersion}
          value={info.scriptVersion}
          onPress={(value: ScriptVersion) => this.updateScriptVersion(value)}
          selected={info.scriptVersion === this.state.scriptVersion}
        >
        </LabeledRadioButton>
      );
    }

    return (
      <View style={styles.container}>
        <ScrollView>
          <View>
            <AppText style={styles.modalTitle}>Script Version</AppText>
            <TouchableWithoutFeedback
              onPress={() => this.toggleInfoExpanded()}
            >
              <View style={styles.infoContainer}>
                <View style={styles.infoHeading}>
                  <AppText style={styles.infoName}>{scriptVersionInfo?.longName} ({scriptVersionInfo?.shortName})</AppText>
                  <AppText style={styles.infoScriptCode}>{scriptVersionInfo?.scriptCode}</AppText>
                </View>
                <View style={infoExpanded ? styles.infoBodyExpanded : styles.infoBodyCollapsed}>
                  <AppText style={styles.infoDescription}>{scriptVersionInfo?.description}</AppText>
                  <LinearGradient
                    style={infoExpanded ?
                      {...styles.infoDescriptionObscure, ...styles.infoDescriptionReveal } :
                      styles.infoDescriptionObscure }
                    colors={[Colors.transparent, 'rgba(0,0,0,1)']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1.0 }}
                  ></LinearGradient>
                </View>
                <View style={styles.expandCollapseAction}>
                  <AppText
                    style={styles.infoExpandCollapseAction}
                  >{infoExpanded ? 'LESS' : 'MORE'}</AppText>
                </View>
              </View>
            </TouchableWithoutFeedback>
            <View>
              {buttons}
            </View>
          </View>
        </ScrollView>
        <View style={styles.actions}>
          <Button
            title='Select'
            onPress={() => this.props.onClose(this.state.scriptVersion)}
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
  infoScriptCode: {
    color: Colors.modalTitle
  },
  infoDescription: {
    ...Typography.textHighlight.x8,
    color: Colors.modalTitle,
  },
  infoDescriptionObscure: {
    height: 22,
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
    marginBottom: 6
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
    ...Typography.capitalization.uppercase
  },
  expandCollapseAction: {
    marginTop: -4
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
