import { useContext } from "react";
import { StyleSheet, View } from "react-native";

import { NavigationProp } from "@react-navigation/native";

import { Layout } from "../../styles";

import { AccountsContext } from "./AccountsContext";
import { TransactionBuilderContext } from "./TransactionBuilderContext";
import UtxoItem from "./UtxoItem";
import { Utxo } from "../../models/Utxo";


interface Props {
  navigation: NavigationProp<any>;
}

export default function AccountUtxosScreen({
  navigation
}: Props) {
  const accountsContext = useContext(AccountsContext);

  const { utxos } = accountsContext.currentAccount;
  const outpoint = (u: Utxo) => `${u.txid}:${u.vout}`;

  return (
    <View style={styles.container}>
      { utxos.map(utxo =>
        <UtxoItem key={outpoint(utxo)} utxo={utxo}></UtxoItem>
      )}
    </View>    
  );
}

const styles = StyleSheet.create({  
  container: {
    ...Layout.container.base
  }
});