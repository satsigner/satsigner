import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useContext, useEffect, useState } from "react";

import { Utxo } from "../../../models/Utxo";

import { AppText } from "../../../components/shared/AppText";
import { TransactionBuilderContext } from "../../../components/accounts/TransactionBuilderContext";
import { Colors, Layout } from "../../../styles";
import { Sats } from "../../../components/accounts/Sats";
import formatAddress from "../../../utils/formatAddress";
import formatDate from "../../../utils/formatDate";
import { UtxoSizeMeter } from "./UtxoSizeMeter";

interface Props {
  utxo: Utxo;
  totalValue: number;
}

export default function UtxoItem({
  utxo,
  totalValue
}: Props) {
  const txnBuilderContext = useContext(TransactionBuilderContext);
  const [ selected, setSelected ] = useState(false);

  useEffect(() => setSelected(txnBuilderContext.hasInput(utxo)), []);

  function onToggleSelected() {
    const txnHasInput = txnBuilderContext.hasInput(utxo);

    txnHasInput ?
      txnBuilderContext.removeInput(utxo) :
      txnBuilderContext.addInput(utxo);

    setSelected (! txnHasInput);
  }

  return (
    <TouchableOpacity onPress={onToggleSelected}>
      <UtxoSizeMeter size={utxo.value} totalSize={totalValue}></UtxoSizeMeter>
      <View style={styles.container}>
        <View style={styles.selectAction}>
          <View style={styles.selectButton}></View>
        </View>
        <View style={styles.detailsContainer}>
          <View style={styles.details}>
            <View style={styles.detailsLeftColumn}>
              <Sats
                sats={utxo.value}
                currencyStyle={styles.currency}
                satsStyle={styles.sats}
                satsLabelStyle={styles.satsLabel}
                usdStyle={styles.usd}
                usdLabelStyle={styles.usdLabel}
              ></Sats>
            </View>
            <View style={styles.detailsRightColumn}>
              <AppText style={styles.address}>{formatAddress(utxo.addressTo)}</AppText>
              <AppText style={styles.date}>{formatDate(utxo.timestamp)}</AppText>
            </View>
          </View>
          <AppText style={styles.memo}>{ utxo.label && 'Memo: '}{utxo.label}</AppText>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.grey27,
    ...Layout.container.horizontalPaddedThin,
    paddingVertical: 15
  },
  selectAction: {
    paddingTop: 3,
    width: '10%',
    // opacity: 0.56,
  },
  selectButton: {
    backgroundColor: Colors.grey79,
    height: 20,
    width: 20,
    borderRadius: 10
  },
  detailsContainer: {
    width: '90%',
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  detailsLeftColumn: {

  },
  detailsRightColumn: {
    alignItems: 'flex-end'
  },
  selected: {
  },
  currency: {
    marginBottom: 5
  },
  sats: {
    fontSize: 14,
    color: Colors.white
  },
  satsLabel: {
    fontSize: 10,
    color: Colors.grey130,
  },
  usd: {
    fontSize: 11,
    color: Colors.white
  },
  usdLabel: {
    fontSize: 11,
    color: Colors.grey130
  },
  memo: {
    color: Colors.white,
    fontSize: 11
  },
  address: {
    color: Colors.white,
    fontSize: 12
  },
  date: {
    color: Colors.grey189,
    fontSize: 12
  }
});
