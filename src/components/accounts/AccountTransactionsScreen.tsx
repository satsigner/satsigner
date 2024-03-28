import { useEffect, useContext } from 'react';
import {
  View,
  StyleSheet
} from 'react-native';

import { NavigationProp } from '@react-navigation/native';

import navUtils from '../../utils/NavUtils';
import { Typography, Colors, Layout } from '../../styles';
import { AppText } from '../shared/AppText';

import { AccountsContext } from './AccountsContext';

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

  return (
    <AccountsContext.Consumer>
      {({currentAccount}) => (
        <View style={styles.container}>
          <AppText>Account: {currentAccount.name} </AppText>
        </View>
      )}
    </AccountsContext.Consumer>      
  );
}

const styles = StyleSheet.create({  
  container: {
    ...Layout.container.base,
    ...Layout.container.horizontalPaddedThin
  }
});