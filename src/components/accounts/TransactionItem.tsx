import { StyleSheet, View } from "react-native";

import TimeAgo from 'react-timeago'

import { AppText } from "../shared/AppText";
import { Colors, Layout, Typography } from "../../styles";
import { Transaction, TransactionType } from "../../models/Transaction";

import IncomingIcon from '../../assets/images/incoming.svg';
import OutgoingIcon from '../../assets/images/outgoing.svg';
import { Sats } from "./Sats";

interface Props {
  transaction: Transaction;
}

const DateText = (props) => <AppText style={styles.dateTime}>{props.children}</AppText>;

export default function TransactionItem({
  transaction
}: Props) {
  const timestamp = new Date(transaction.timestamp as Date);

  const timeFormatter = (value: number, unit: string, suffix: string) => {
    if (unit === 'second') {
        return 'less than a minute ' + suffix;
    } else if (unit === 'minute' || unit === 'hour') {
        return `${value} ${unit}${
          value !== 1 ? 's' : ''
      } ${suffix}`;
    } else {
      return `${formatTime(timestamp)} - ${formatDate(timestamp)}`;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        { transaction.type === TransactionType.Send && <OutgoingIcon /> }
        { transaction.type === TransactionType.Receive && <IncomingIcon width={19} height={19} /> }
      </View>
      <View style={styles.details}>
        <View style={styles.leftColumn}>
          <TimeAgo
            date={timestamp}
            component={DateText}
            live={true}
            formatter={timeFormatter}
          />
          <Sats
            sats={transaction.type === TransactionType.Send ?
              -transaction.sent :
              transaction.received
            }
            currencyStyle={styles.currency}
            satsStyle={styles.sats}
            satsLabelStyle={styles.satsLabel}
            usdStyle={styles.usd}
            usdLabelStyle={styles.usdLabel}
          />
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

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric'
  }).format(date).replace(' ', '').toLowerCase();
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
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
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  sats: {
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
    color: Colors.grey111
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