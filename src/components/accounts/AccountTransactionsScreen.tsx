import { useEffect, useContext } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableHighlight
} from 'react-native';

import { NavigationProp } from '@react-navigation/native';

import navUtils from '../../utils/NavUtils';
import { Typography, Colors, Layout } from '../../styles';
import { AppText } from '../shared/AppText';

import { AccountsContext } from './AccountsContext';
import numFormat from '../../utils/numFormat';
import BackgroundGradient from '../shared/BackgroundGradient';
import LinearGradient from 'react-native-linear-gradient';

import CameraIcon from '../../assets/images/camera.svg';
import notImplementedAlert from '../shared/NotImplementedAlert';

interface Props {
  navigation: NavigationProp<any>;
}

export default function AccountTransactionsScreen({
  navigation
}: Props) {
  const context = useContext(AccountsContext);

  useEffect(() => {
    navUtils.setHeaderTitle(context.currentAccount.name, navigation);
  }, []);

  const GradientSeparator = () => <LinearGradient
    style={{width: '100%', height: 1}}
    colors={[Colors.grey61, Colors.grey38]}
    start={{x: 0, y: 0}}
    end={{x: 1.0, y: 0}}
  />;

  const ActionButton = (props: any) => <TouchableHighlight
    activeOpacity={0.65}
    underlayColor={Colors.grey38}
    style={[{
      width: '40%',
      height: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }, props.style]}
    onPress={props.onPress}
  >
    {props.children}
  </TouchableHighlight>;

  return (
    <AccountsContext.Consumer>
      {({currentAccount: account}) => (
        <View style={styles.container}>
          <BackgroundGradient orientation={'horizontal'}>
            <View style={styles.header}>
              <View style={styles.currency}><AppText style={styles.sats}>{numFormat(account?.snapshot?.balanceSats)}</AppText><AppText style={styles.satsLabel}>sats</AppText></View>
              <View style={styles.currency}><AppText style={styles.usd}>{numFormat(account?.snapshot?.balanceUsd, 2)}</AppText><AppText style={styles.usdLabel}>USD</AppText></View>
            </View>
            <GradientSeparator />
            <View style={styles.actionBar}>
              <ActionButton style={{
                  borderRightWidth: 1,
                  borderRightColor: Colors.grey48,                
                }}
                onPress={notImplementedAlert}
              >
                <AppText style={styles.actionLabel}>Sign & Send</AppText>
              </ActionButton>
              <ActionButton
                style={{width: '20%'}}
                onPress={notImplementedAlert}
              >
                <CameraIcon width={18} height={13} />
              </ActionButton>
              <ActionButton style={{
                  borderLeftWidth: 1,
                  borderLeftColor: Colors.grey48,                
                }}
                onPress={notImplementedAlert}
              >
                <AppText style={styles.actionLabel}>New Invoice</AppText>
              </ActionButton>
            </View>
            <GradientSeparator />
            <View style={styles.tabs}>
              <AppText>Tabs</AppText>
            </View>
            <GradientSeparator />
          </BackgroundGradient>
          <View style={styles.transactionsHeader}>
            <AppText>Transactions Header</AppText>
          </View>
          <ScrollView style={styles.transactions}>
            <AppText>Transactions</AppText>
          </ScrollView>
        </View>
      )}
    </AccountsContext.Consumer>      
  );
}

const styles = StyleSheet.create({  
  container: {
    ...Layout.container.base
  },
  header: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 100,
    paddingBottom: 15
  },
  currency: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 1
  },
  sats: {
    ...Typography.fontFamily.sfProTextUltraLight,
    fontSize: 50,
    marginLeft: 40,
    color: Colors.white
  },
  satsLabel: {
    fontSize: 21,
    color: Colors.middleGrey,
    marginLeft: 0
  },
  usd: {
    fontSize: 15,
    color: Colors.middleGrey
  },
  usdLabel: {
    fontSize: 11,
    color: Colors.quarterGrey,
    marginLeft: 3
  },
  actionBar: {
    height: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center'
  },
  actionLabel: {
    ...Typography.capitalization.uppercase
  },
  tabs: {
    height: 75,
  },
  transactionsHeader: {
    height: 75,
    borderBottomColor: 'white',
    borderBottomWidth: 1
  },
  transactions: {

  }
});



