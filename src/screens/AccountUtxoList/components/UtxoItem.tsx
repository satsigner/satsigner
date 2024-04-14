import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useContext, useState } from "react";

import { Utxo } from "../../../models/Utxo";

import { AppText } from "../../../components/shared/AppText";
import { TransactionBuilderContext } from "../../../components/accounts/TransactionBuilderContext";
import { Colors } from "../../../styles";

interface Props {
  utxo: Utxo;
}

export default function UtxoItem({
  utxo
}: Props) {
  const txnBuilderContext = useContext(TransactionBuilderContext);
  const [ selected, setSelected ] = useState(false);

  function onToggleSelected() {
    const txnHasInput = txnBuilderContext.hasInput(utxo);

    txnHasInput ?
      txnBuilderContext.removeInput(utxo) :
      txnBuilderContext.addInput(utxo);

    setSelected (! txnHasInput);
  }

  return (
    <TouchableOpacity onPress={onToggleSelected}>
      <View style={selected ? styles.selected : {}}>
        <AppText>{utxo.txid}:{utxo.vout}</AppText>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  selected: {
    padding: 5,
    margin: 5,
    backgroundColor: Colors.red4
  }
});
