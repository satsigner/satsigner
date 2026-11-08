import { StyleSheet } from 'react-native'

import SSText from '@/components/SSText'
import { PRIVACY_MASK } from '@/constants/privacy'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { type ArkBalanceRow, type ArkBalanceRowKey } from '@/utils/ark'
import { formatNumber } from '@/utils/format'

const ROW_LABEL_KEYS: Record<ArkBalanceRowKey, string> = {
  claimableLightningReceive: 'ark.balance.breakdown.claimableLightningReceive',
  needsRefresh: 'ark.balance.breakdown.needsRefresh',
  offchain: 'ark.balance.breakdown.offchain',
  onchain: 'ark.balance.breakdown.onchain',
  onchainPending: 'ark.balance.breakdown.onchainPending',
  pendingArkoorSend: 'ark.balance.breakdown.pendingArkoorSend',
  pendingBoard: 'ark.balance.breakdown.pendingBoard',
  pendingExit: 'ark.balance.breakdown.pendingExit',
  pendingInRound: 'ark.balance.breakdown.pendingInRound',
  pendingLightningSend: 'ark.balance.breakdown.pendingLightningSend',
  pendingOffboard: 'ark.balance.breakdown.pendingOffboard'
}

type SSArkBalanceBreakdownProps = {
  rows: ArkBalanceRow[]
  privacyMode: boolean
}

function SSArkBalanceBreakdown({
  rows,
  privacyMode
}: SSArkBalanceBreakdownProps) {
  return (
    <SSVStack gap="none" style={styles.container}>
      {rows.map((row) => (
        <SSHStack key={row.key} justifyBetween style={styles.row}>
          <SSText color="muted" size="xs">
            {t(ROW_LABEL_KEYS[row.key])}
          </SSText>
          <SSHStack gap="xxs" style={styles.amount}>
            <SSText size="xs">
              {privacyMode ? PRIVACY_MASK : formatNumber(row.amountSats)}
            </SSText>
            <SSText color="muted" size="xxs">
              {t('bitcoin.sats')}
            </SSText>
          </SSHStack>
        </SSHStack>
      ))}
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  amount: {
    alignItems: 'baseline'
  },
  container: {
    alignSelf: 'stretch',
    borderTopColor: Colors.gray[800],
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
    paddingTop: 6
  },
  row: {
    paddingVertical: 3
  }
})

export default SSArkBalanceBreakdown
