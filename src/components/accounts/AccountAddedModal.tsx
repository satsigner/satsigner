import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet
} from 'react-native';

import { AccountsContext } from './AccountsContext';

import Button from '../shared/Button';
import { AppText } from '../shared/AppText';

import LinearGradient from 'react-native-linear-gradient';

import { Typography, Layout, Colors } from '../../styles';
import { ScriptVersion } from '../../enums/ScriptVersion';
import { ScriptVersionInfos } from './ScriptVersionInfos';

interface Props {
  onClose: () => void
}

interface State {
}

export default class AccountAddedModal extends React.PureComponent<Props, State> {
  
  constructor(props: any) {
    super(props);

    this.state = {
    };
  }

  getScriptLongName(scriptVersion: ScriptVersion): string {
    return ScriptVersionInfos.get(scriptVersion)?.longName || '';
  }

  getScriptShortName(scriptVersion: ScriptVersion): string {
    return ScriptVersionInfos.get(scriptVersion)?.shortName || '';
  }

  render() {
    // const { } = this.state;

    const Separator = () => 
      <LinearGradient
        style={{
          width: '100%',
          height: 1
        }}
        colors={[Colors.grey61, Colors.grey38]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      />;
  
    return (
      <AccountsContext.Consumer>
        {({ currentAccount }) => (
          <View style={{
            flex: 1,
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            ...Layout.container.horizontalPadded
          }}>
            <LinearGradient
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                alignItems: 'center',
                width: '100%',
                borderRadius: 3,
              }}
              colors={[Colors.grey21, Colors.grey47]}
              start={{ x: 1, y: 1 }}
              end={{ x: 0, y: 0 }}
            >
              <View style={{...styles.columnSection, height: 139 }}>
                <AppText style={{color: Colors.highlight, fontSize: 26 }}>{currentAccount.name}</AppText>
                <AppText style={{color: Colors.grey118, fontSize: 17, marginTop: 1}}>Parent account has been added</AppText>
              </View>

              <Separator />
              
              <View style={{...styles.columnSection, height: 112}}>
                <View style={{...styles.rowSection, alignItems: 'flex-start' }}>
                    <View style={styles.columnSection}>
                      <AppText style={{color: Colors.grey79, fontSize: 9}}>Script</AppText>
                      <AppText style={{color: Colors.grey130, fontSize: 12}}>{this.getScriptLongName(currentAccount.scriptVersion as ScriptVersion)}</AppText>
                      <AppText style={{color: Colors.grey130, fontSize: 12}}>({this.getScriptShortName(currentAccount.scriptVersion as ScriptVersion)})</AppText>
                    </View>
                    <View style={styles.columnSection}>
                      <AppText style={{color: Colors.grey79, fontSize: 9}}>Fingerprint</AppText>
                      <AppText style={{color: Colors.grey130, fontSize: 12}}>73c5da0a</AppText>
                    </View>
                </View>
              </View>

              <Separator />

              <View style={{...styles.columnSection, height: 162 }}>
                <AppText style={{color: Colors.grey79, fontSize: 9}}>Searching derivation path</AppText>
                <AppText style={{color: Colors.grey130, fontSize: 16}}>m/49'/0'</AppText>
              </View>

              <Button
                title='Close'
                onPress={() => this.props.onClose()}
                style={styles.closeButton}
              ></Button>
            </LinearGradient>
          </View>
        )}
      </AccountsContext.Consumer>
        
    );
  }

}

const styles = StyleSheet.create({
  columnSection: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center'
  },
  rowSection: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    width: '100%'
  },
  closeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.11)',
    color: Colors.actionText,
    width: '100%',
    marginBottom: 0,
    borderRadius: 0
  },
});
