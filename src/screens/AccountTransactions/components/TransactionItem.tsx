import { StyleSheet, View } from "react-native";

import { AppText } from "../../../components/shared/AppText";
import { Colors, Layout, Typography } from "../../../styles";
import { Transaction, TransactionType } from "../../../models/Transaction";
import formatAddress from "../../../utils/formatAddress";

import IncomingIcon from '../../../assets/images/incoming.svg';
import OutgoingIcon from '../../../assets/images/outgoing.svg';
import { Sats } from "../../../components/accounts/Sats";

import TransactionDateTime from "./TransactionDateTime";
import TransactionConfirmations from "./TransactionConfirmations";

interface Props {
  transaction: Transaction;
  blockchainHeight: number;
}

export default function TransactionItem({
  transaction,
  blockchainHeight
}: Props) {

  const showTime = !! transaction.timestamp;
  const timestamp = new Date(transaction.timestamp as Date);
  const { blockHeight, memo } = transaction;

  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        { transaction.type === TransactionType.Send && <OutgoingIcon /> }
        { transaction.type === TransactionType.Receive && <IncomingIcon width={19} height={19} /> }
      </View>
      <View style={styles.details}>
        <View style={styles.leftColumn}>
          { showTime && <TransactionDateTime date={timestamp} /> }
          <Sats
            sats={transaction.type === TransactionType.Send ?
              -transaction.sent :
              transaction.received
            }
            currencyStyle={styles.currency}
            satsStyle={[styles.sats, ! showTime && styles.satsNoTime]}
            satsLabelStyle={styles.satsLabel}
            usdStyle={styles.usd}
            usdLabelStyle={styles.usdLabel}
          />
        </View>
        <View style={styles.rightColumn}>
          <TransactionConfirmations blockchainHeight={blockchainHeight} blockHeight={blockHeight} />
          <View style={styles.rightColumnBottom}>
            <AppText numberOfLines={1} style={[styles.memo, ! memo && styles.noMemo]}>{ memo || 'No memo' }</AppText>
            { transaction.address && <View style={styles.otherParties}>
              <AppText style={styles.direction}>to</AppText>
              <AppText style={styles.addressIO}>{formatAddress(transaction.address)}</AppText>
            </View> }
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
  currency: {
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  sats: {
    fontSize: 28,
  },
  satsNoTime: {
    marginTop: -6
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
    color: Colors.grey111
  },
  memo: {
    marginBottom: 3,
    textAlign: 'right',
    color: Colors.white,
    letterSpacing: 0,
    width: 150
  },
  noMemo: {
    color: Colors.grey181
  },
  otherParties: {
    flexDirection: 'row',
    alignItems: 'flex-end'
  },
  rightColumnBottom: {
    flexDirection: 'column',
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