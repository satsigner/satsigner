import { StyleSheet } from "react-native";

import { AppText } from "../../../components/shared/AppText";
import { Colors, Typography } from "../../../styles";

interface Props {
  blockchainHeight: number;
  blockHeight?: number;
}

export default function TransactionConfirmations({
  blockchainHeight,
  blockHeight
}: Props) {
  const confirmations = getConfirmations(blockchainHeight, blockHeight);
  const confirmationsText = getConfirmationsText(confirmations);
  const confirmationsColorStyle = getConfirmationsColorStyle(confirmations);

  return (
    <AppText style={[styles.confirmations, confirmationsColorStyle]}>
      { blockchainHeight ? confirmationsText : '' }
    </AppText>
  );
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
  }
});