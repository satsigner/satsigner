import { useCallback, useEffect } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";

import { NavigationProp } from "@react-navigation/native";

import { Colors, Layout } from "../../styles";
import { useAccountsContext } from "../../components/accounts/AccountsContext";
import { useTransactionBuilderContext } from "../../components/accounts/TransactionBuilderContext";
import navUtils from "../../utils/NavUtils";

import SelectedUtxosHeader from "../../components/accounts/SelectedUtxosHeader";

import UtxoItem from "./components/UtxoItem";
import Button from "../../components/shared/Button";
import notImplementedAlert from "../../components/shared/NotImplementedAlert";

import { ActionBar } from "./components/ActionBar";
import { Utxo } from "../../models/Utxo";

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

  const largestValue = Math.max(...utxos.map(utxo => utxo.value));
  const totalValue = utxos.reduce((acc, utxo) => acc + utxo.value, 0);

  useEffect(() => {
    navUtils.setHeaderTitle(currentAccount.name, navigation);
  }, []);

  const selectAll = useCallback((): void => {
    utxos.forEach(
      input => txnBuilderContext.addInput(input)
    );
  }, [txnBuilderContext]);

  const toggleSelected = useCallback((utxo: Utxo): void => {
    const txnHasInput = txnBuilderContext.hasInput(utxo);

    txnHasInput ?
      txnBuilderContext.removeInput(utxo) :
      txnBuilderContext.addInput(utxo);
  }, [txnBuilderContext]);

  return (
    <View style={styles.container}>
      <SelectedUtxosHeader toggleScreenAction="bubbles" navigation={navigation} />
      <ActionBar totalValue={totalValue} onSelectAll={selectAll} />
      <View>
        <View style={styles.scrollBackground} />
        <ScrollView
          style={styles.utxosScroll}
          contentContainerStyle={Platform.OS === 'android' ?
            styles.utxosScrollContentContainerAndroid :
            styles.utxosScrollContentContainer }
        >
          <View style={styles.utxosBackground}>
            { utxos.map(utxo =>
              <UtxoItem
                key={getUtxoKey(utxo)}
                utxo={utxo}
                utxoSelected={txnBuilderContext.hasInput(utxo)}
                onToggleSelected={toggleSelected}
                largestValue={largestValue}
              />
            )}
          </View>
        </ScrollView>
      </View>
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
  // Start background below edge of top unselected UTXO
  // Keeps enlarged size meter top edge from getting cut off
  //   while still showing correct background color behind it
  scrollBackground: {
    position: 'absolute',
    backgroundColor: Colors.grey27,
    width: '100%',
    top: 2,
    height: 1000
  },
  utxosScrollContentContainer: {
    paddingBottom: 276
  },
  utxosScrollContentContainerAndroid: {
    paddingBottom: 346
  },
  utxosScroll: {
  },
  utxosBackground: {
    backgroundColor: Colors.grey38,
    marginTop: 2
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
