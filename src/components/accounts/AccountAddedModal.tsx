import React from 'react';
import {
  View,
  StyleSheet
} from 'react-native';

import { AccountsContext } from './AccountsContext';

import Button from '../shared/Button';
import { AppText } from '../shared/AppText';

import LinearGradient from 'react-native-linear-gradient';

import { Typography, Layout, Colors } from '../../styles';
import { ScriptVersion } from '../../enums/ScriptVersion';
import { ScriptVersionInfos } from './ScriptVersionInfos';

import numFormat from '../../utils/numFormat';

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
          <View style={styles.dimmedOverlay}>
            <LinearGradient
              style={styles.dialogBackground}
              colors={[Colors.grey21, Colors.grey47]}
              start={{ x: 1, y: 1 }}
              end={{ x: 0, y: 0 }}
            >
              <View style={{...styles.columnSection, height: 137 }}>
                <AppText style={styles.heading}>{currentAccount.name}</AppText>
                <AppText style={styles.subheading}>Parent account has been added</AppText>
              </View>

              <Separator />
              
              <View style={{...styles.columnSection, height: 112}}>
                <View style={{...styles.rowSection, alignItems: 'flex-start' }}>
                    <View style={styles.columnSection}>
                      <AppText style={styles.label}>Script</AppText>
                      <AppText style={{...styles.valueSmall, marginTop: 2 }}>{this.getScriptLongName(currentAccount.scriptVersion as ScriptVersion)}</AppText>
                      <AppText style={styles.valueSmall}>({this.getScriptShortName(currentAccount.scriptVersion as ScriptVersion)})</AppText>
                    </View>
                    <View style={styles.columnSection}>
                      <AppText style={styles.label}>Fingerprint</AppText>
                      <AppText style={{...styles.valueSmall, marginTop: 2 }}>{currentAccount?.fingerprint}</AppText>
                    </View>
                </View>
              </View>

              <Separator />

              <View style={{...styles.columnSection, height: 152, marginTop: 10 }}>
                <View style={styles.columnSection}>
                  <AppText style={styles.label}>Searching derivation path</AppText>
                  <AppText style={{...styles.valueLarge, marginTop: 8, letterSpacing: 5 }}>{currentAccount?.derivationPath}</AppText>
                </View>
                <View style={{...styles.rowSection, alignItems: 'flex-start', marginTop: 30 }}>
                    <View style={styles.columnSection}>
                      <AppText style={styles.label}>Found UTXOs</AppText>
                      <AppText style={{...styles.valueLarge, marginTop: 8}}>{numFormat(currentAccount?.snapshot?.numUtxos)}</AppText>
                    </View>
                    <View style={styles.columnSection}>
                      <AppText style={styles.label}>Total spendable sats</AppText>
                      <AppText style={{...styles.valueLarge, marginTop: 8}}>{numFormat(currentAccount?.snapshot?.balanceSats)}</AppText>
                    </View>
                </View>
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
  dimmedOverlay: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    ...Layout.container.horizontalPadded
  },
  dialogBackground: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
    width: '100%',
    borderRadius: 3,
  },
  heading: {
    ...Typography.fontFamily.sfProDisplayMedium,
    color: Colors.highlight,
    fontSize: 26
  },
  subheading: {
    ...Typography.fontFamily.sfProDisplayMedium,
    color: Colors.grey118,
    fontSize: 17,
    marginTop: 1
  },
  label: {
    ...Typography.fontFamily.sfProDisplayMedium,
    color: Colors.grey79,
    fontSize: 10
  },
  valueSmall: {
    ...Typography.fontFamily.sfProDisplayMedium,
    color: Colors.grey130,
    fontSize: 13
  },
  valueLarge: {
    ...Typography.fontFamily.sfProDisplayMedium,
    color: Colors.grey130,
    fontSize: 17
  },
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
