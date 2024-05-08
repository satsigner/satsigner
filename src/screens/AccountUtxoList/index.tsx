import { useEffect } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { NavigationProp } from "@react-navigation/native";

import { Colors, Layout } from "../../styles";
import { useAccountsContext } from "../../components/accounts/AccountsContext";
import { useTransactionBuilderContext } from "../../components/accounts/TransactionBuilderContext";
import navUtils from "../../utils/NavUtils";

import SelectedUtxosHeader from "../../components/accounts/SelectedUtxosHeader";

import UtxoItem from "./components/UtxoItem";
import Button from "../../components/shared/Button";
import notImplementedAlert from "../../components/shared/NotImplementedAlert";

interface Props {
  navigation: NavigationProp<any>;
}

export default function AccountUtxoListScreen({
  navigation
}: Props) {
  const { currentAccount, currentAccount: { utxos } } = useAccountsContext();
  const txnBuilderContext = useTransactionBuilderContext();

  const getUtxoKey = txnBuilderContext.getOutpoint;
  const hasSelectedUtxos = txnBuilderContext.getInputs().length > 0;

  useEffect(() => {
    navUtils.setHeaderTitle(currentAccount.name, navigation);
  }, []);

  const itemsScrollViewPaddingBottom = 85;
  const largestValue = Math.max(...utxos.map(utxo => utxo.value));

  return (
    <View style={styles.container}>
      <SelectedUtxosHeader toggleScreenAction="bubbles" navigation={navigation} />
      <ScrollView style={styles.utxosContainer} contentInset={{bottom: itemsScrollViewPaddingBottom}}>
        <View style={styles.utxosBackgroundContainer}>
          { utxos.map(utxo =>
            <UtxoItem key={getUtxoKey(utxo)} utxo={utxo} largestValue={largestValue}></UtxoItem>
          )}
        </View>
      </ScrollView>
      <View style={styles.submitContainer}>
        <Button
          title="Add As Inputs To Message"
          style={ hasSelectedUtxos ? styles.submitEnabled : styles.submitDisabled }
          disabled={! hasSelectedUtxos}
          onPress={notImplementedAlert}
        ></Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({  
  container: {
    ...Layout.container.base,
    ...Layout.container.topPaddedThin
  },
  utxosContainer: {
    marginTop: 25,
    backgroundColor: Colors.grey27
  },
  utxosBackgroundContainer: {
    backgroundColor: Colors.grey38
  },
  submitContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 20,
    width: '100%'
  },
  submitEnabled: {
    width: '92%',
    backgroundColor: Colors.defaultActionBackground,
    color: Colors.defaultActionText
  },
  submitDisabled: {
    width: '92%',
    backgroundColor: Colors.disabledActionBackground,
    color: Colors.disabledActionText
  }
});
