import type { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import type { RefObject } from 'react'
import { StyleSheet } from 'react-native'

import SSBottomSheet from '@/components/SSBottomSheet'
import SSButton from '@/components/SSButton'
import SSPressable from '@/components/SSPressable'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { Account } from '@/types/models/Account'
import { formatMaskedSats } from '@/utils/format'

const ROW_ACTIVE_OPACITY = 0.6

type PickerAccount = Pick<Account, 'id' | 'name' | 'summary'>

type SSChatAccountPickerProps<T extends PickerAccount> = {
  ref: RefObject<BottomSheetMethods | null>
  accounts: T[]
  amountSats: number
  privacyMode: boolean
  onSelect: (account: T) => void
}

type AccountRowProps<T extends PickerAccount> = {
  account: T
  privacyMode: boolean
  onSelect: (account: T) => void
}

function AccountRow<T extends PickerAccount>({
  account,
  privacyMode,
  onSelect
}: AccountRowProps<T>) {
  function handlePress() {
    onSelect(account)
  }

  return (
    <SSPressable
      style={styles.row}
      onPress={handlePress}
      activeOpacity={ROW_ACTIVE_OPACITY}
    >
      <SSVStack gap="xxs">
        <SSText size="md" weight="medium">
          {account.name}
        </SSText>
        <SSText size="xs" color="muted">
          {formatMaskedSats(account.summary.balance, privacyMode)}
        </SSText>
      </SSVStack>
    </SSPressable>
  )
}

function SSChatAccountPicker<T extends PickerAccount>({
  ref,
  accounts,
  amountSats,
  privacyMode,
  onSelect
}: SSChatAccountPickerProps<T>) {
  function handleCancel() {
    ref.current?.close()
  }

  const title =
    amountSats > 0
      ? t('nostrIdentity.chat.payment.payFromAmount', {
          amount: formatMaskedSats(amountSats, privacyMode)
        })
      : t('nostrIdentity.chat.payment.payFrom')

  return (
    <SSBottomSheet ref={ref} title={title}>
      <SSVStack gap="md" style={styles.content}>
        {accounts.map((account) => (
          <AccountRow
            key={account.id}
            account={account}
            privacyMode={privacyMode}
            onSelect={onSelect}
          />
        ))}
        <SSButton
          label={t('common.cancel')}
          variant="ghost"
          onPress={handleCancel}
        />
      </SSVStack>
    </SSBottomSheet>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 16
  },
  row: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 3,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14
  }
})

export default SSChatAccountPicker
