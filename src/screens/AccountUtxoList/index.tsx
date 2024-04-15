import { StyleSheet, View } from "react-native";

import { NavigationProp } from "@react-navigation/native";

import { Layout } from "../../styles";
import { useAccountsContext } from "../../components/accounts/AccountsContext";
import { Utxo } from "../../models/Utxo";

import UtxoItem from "./components/UtxoItem";
import navUtils from "../../utils/NavUtils";
import { useEffect } from "react";
import SelectedUtxosHeader from "./components/SelectedUtxosHeader";

interface Props {
  navigation: NavigationProp<any>;
}

export default function AccountUtxoListScreen({
  navigation
}: Props) {
  const accountsContext = useAccountsContext();
  const { currentAccount } = accountsContext;
  const { utxos } = currentAccount;

  useEffect(() => {
    navUtils.setHeaderTitle(currentAccount.name, navigation);
  }, []);

  const outpoint = (u: Utxo) => `${u.txid}:${u.vout}`;

  return (
    <View style={styles.container}>
      <SelectedUtxosHeader
      />
      <View>
        { utxos.map(utxo =>
          <UtxoItem key={outpoint(utxo)} utxo={utxo}></UtxoItem>
        )}
      </View>
    </View>    
  );
}

const styles = StyleSheet.create({  
  container: {
    ...Layout.container.base,
    ...Layout.container.topPadded,
    ...Layout.container.horizontalPadded
  }
});
