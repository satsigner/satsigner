import { useEffect, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { Utxo } from "../../../models/Utxo";
import { AppText } from "../../../components/shared/AppText";
import { Colors, Layout } from "../../../styles";
import { Sats } from "../../../components/accounts/Sats";
import formatAddress from "../../../utils/formatAddress";
import formatDate from "../../../utils/formatDate";

import { UtxoSizeMeter } from "./UtxoSizeMeter";
import SelectionIndicator from "./SelectionIndicator";

interface Props {
  utxo: Utxo;
  utxoSelected: boolean;
  onToggleSelected: (utxo: Utxo) => void;
  largestValue: number;
}

export default function UtxoItem({
  utxo,
  utxoSelected,
  onToggleSelected,
  largestValue
}: Props) {
  const [ selected, setSelected ] = useState(false);

  useEffect(() => setSelected(utxoSelected), [utxoSelected]);

  return (
    <View>
      <TouchableOpacity onPress={() => onToggleSelected(utxo)}>
        <View style={styles.container}>
          <View style={styles.selectAction}>
            <SelectionIndicator selected={selected} />
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
      <View style={styles.sizeMeter}>
        <UtxoSizeMeter size={utxo.value} largestSize={largestValue} selected={selected}></UtxoSizeMeter>
      </View>
    </View>
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
    width: '10%'
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
  },
  sizeMeter: {
    position: 'absolute',
    width: '100%'
  }
});
