import { StyleSheet, View } from "react-native";

import { AppText } from "../shared/AppText";
import { Colors, Layout, Typography } from "../../styles";
import { Transaction, TransactionType } from "../../models/Transaction";

import IncomingIcon from '../../assets/images/incoming.svg';
import OutgoingIcon from '../../assets/images/outgoing.svg';
import numFormat from "../../utils/numFormat";
import satsToUsd from "../shared/satsToUsd";
import { grey103 } from "../../styles/colors";

interface Props {
  transaction: Transaction;
}

export default function TransactionItem({
  transaction
}: Props) {

  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        { transaction.type === TransactionType.Send && <OutgoingIcon /> }
        { transaction.type === TransactionType.Receive && <IncomingIcon width={19} height={19} /> }
      </View>
      <View style={styles.details}>
        <View style={styles.leftColumn}>
          <AppText style={styles.dateTime}>5 mins ago</AppText>
          <View style={styles.currency}><AppText style={styles.sats}>{numFormat(transaction.received)}</AppText><AppText style={styles.satsLabel}>sats</AppText></View>
          <View style={styles.currency}><AppText style={styles.usd}>{numFormat(satsToUsd(transaction.received), 2)}</AppText><AppText style={styles.usdLabel}>USD</AppText></View>        
        </View>
        <View style={styles.rightColumn}>
          <AppText style={styles.blockHeight}>unconfirmed</AppText>
          <View>
            <AppText style={styles.memo}>No memo</AppText>
            <View style={styles.otherParties}><AppText style={styles.direction}>from</AppText><AppText style={styles.addressIO}>31zi8K...sQBg7</AppText></View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({  
  container: {
    ...Layout.container.base,
    paddingTop: 16,
    marginBottom: 23,
    display: 'flex',
    flexDirection: 'row',
    borderTopColor: Colors.grey44,
    borderTopWidth: 1,
  },
  icon: {

  },
  details: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
    marginLeft: 12
  },
  leftColumn: {

  },
  rightColumn: {
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  dateTime: {
    ...Typography.fontFamily.sfProDisplayRegular,
    ...Typography.fontSize.x4,
    color: Colors.grey130
  },
  currency: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    marginTop: 1
  },
  sats: {
    ...Typography.fontFamily.sfProTextLight,
    fontSize: 28,
  },
  satsLabel: {
    ...Typography.fontFamily.sfProDisplayRegular,
    ...Typography.fontSize.x5,
    color: Colors.grey130,
    marginLeft: 4,
    marginBottom: 3
  },
  usd: {
    ...Typography.fontFamily.sfProDisplayRegular,
    ...Typography.fontSize.x4,
    color: Colors.grey111
  },
  usdLabel: {
    ...Typography.fontFamily.sfProDisplayRegular,
    ...Typography.fontSize.x4,
    color: Colors.grey111,
    marginLeft: 3
  },
  // white
  // FEFF5D
  // 608A64
  blockHeight: {
    color: Colors.white,
    ...Typography.fontSize.x3,
    textAlign: 'right'
  },
  memo: {
    marginBottom: 3,
    textAlign: 'right',
    color: Colors.grey181,
    letterSpacing: 0
  },
  otherParties: {
    flexDirection: 'row',
    alignItems: 'flex-end'
  },
  direction: {
    color: Colors.grey130,
    ...Typography.fontSize.x4,
    letterSpacing: 0,
    marginRight: 3
  },
  addressIO: {
    color: Colors.white,
    ...Typography.fontSize.x4,
    letterSpacing: 0
  }
});