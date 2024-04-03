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
  blockchainHeight: number;
}

const DateText = (props) => <AppText style={styles.dateTime}>{props.children}</AppText>;

export default function TransactionItem({
  transaction,
  blockchainHeight
}: Props) {

  const showTime = !! transaction.timestamp;
  const timestamp = new Date(transaction.timestamp as Date);
  const { blockHeight, memo } = transaction;

  const confirmations = getConfirmations(blockchainHeight, blockHeight);
  const confirmationsText = getConfirmationsText(confirmations);
  const confirmationsColorStyle = getConfirmationsColorStyle(confirmations);

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
          { showTime && <TimeAgo
            date={timestamp}
            component={DateText}
            live={true}
            formatter={timeFormatter}
          /> }
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
          <AppText style={[styles.confirmations, confirmationsColorStyle]}>{ blockchainHeight && confirmationsText }</AppText>
          <View style={styles.rightColumnBottom}>
            <AppText numberOfLines={1} style={[styles.memo, ! memo && styles.noMemo]}>{ memo || 'No memo' }</AppText>
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

function getConfirmations(currentBlockHeight: number, transactionBlockHeight?: number): number {
  return transactionBlockHeight ?
    currentBlockHeight - transactionBlockHeight + 1 :
    0;
}

// returns one of: unconfirmed, 1 block deep, (2|3|4|5|6+|10+|100+|1k+|10k+|100k+) blocks deep
function getConfirmationsText(confirmations: number): string {
  if (confirmations === 0) {
    // 0
    return 'unconfirmed';
  }
  else if (confirmations === 1) {
    // 1
    return '1 block deep';
  } else if (confirmations < 6) {
    // 2..5
    return confirmations + ' blocks deep';
  } else if (confirmations < 10) {
    // 6..9
    return '6+ blocks deep';
  } else if (confirmations < 100) {
    // 10..99
    return '10+ blocks deep'
  } else if (confirmations < 1_000) {
    // 100..999
    return '100+ blocks deep';
  } else if (confirmations < 10_000) {
    // 1,000..9,999
    return '1k+ blocks deep';
  } else if (confirmations < 100_000) {
    // 10,000..99,999
    return '10k+ blocks deep';
  } else {
    // 100,000+
    return '100k+ blocks deep';
  }
}

function getConfirmationsColorStyle(confirmations: number): any {
  if (confirmations === 0) {
    return styles.confirmationsUnconfirmed;
  } else if (confirmations < 6) {
    return styles.confirmationsFew;
  } else {
    return styles.confirmationsEnough;
  }
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
  confirmations: {
    ...Typography.fontSize.x3,
    textAlign: 'right'
  },
  confirmationsUnconfirmed: {
    color: Colors.white,
  },
  confirmationsFew: {
    color: Colors.yellow1,
  },
  confirmationsEnough: {
    color: Colors.green1,
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