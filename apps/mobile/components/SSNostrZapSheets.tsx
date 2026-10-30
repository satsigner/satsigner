import { useState } from 'react'
import { StyleSheet } from 'react-native'

import SSBottomSheet from '@/components/SSBottomSheet'
import SSButton from '@/components/SSButton'
import SSPaymentMethodPicker from '@/components/SSPaymentMethodPicker'
import SSTextInput from '@/components/SSTextInput'
import { NOSTR_PRIVACY_MASK } from '@/constants/nostr'
import { type NostrZapFlowSheets } from '@/hooks/useNostrZapFlow'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

type SSNostrZapSheetsProps = NostrZapFlowSheets & {
  btcPrice?: number
  fiatCurrency?: string
  privacyMode: boolean
}

function parseSats(value: string): number {
  const sats = Number.parseInt(value, 10)
  return Number.isFinite(sats) && sats > 0 ? sats : 0
}

/** The zap options sheet (amounts and a message) and the wallet picker. */
function SSNostrZapSheets({
  btcPrice,
  fiatCurrency,
  onPaymentMethodSelect,
  onZapOptionsSubmit,
  payAmount,
  paymentMethods,
  paymentSheetRef,
  presets,
  privacyMode,
  zapSheetRef
}: SSNostrZapSheetsProps) {
  const [customAmount, setCustomAmount] = useState('')
  const [comment, setComment] = useState('')
  const customSats = parseSats(customAmount)

  function submit(sats: number) {
    const message = comment.trim()
    setCustomAmount('')
    setComment('')
    onZapOptionsSubmit(sats, message || undefined)
  }

  function handleCustomSubmit() {
    if (customSats > 0) {
      submit(customSats)
    }
  }

  function handleCancel() {
    zapSheetRef.current?.close()
  }

  return (
    <>
      <SSBottomSheet
        ref={zapSheetRef}
        title={t('nostrIdentity.note.zapChooseAmount')}
      >
        <SSVStack gap="sm" style={styles.content}>
          <SSHStack gap="sm">
            {presets.map((sats) => (
              <SSButton
                key={sats}
                label={privacyMode ? NOSTR_PRIVACY_MASK : sats.toLocaleString()}
                variant="outline"
                onPress={() => submit(sats)}
                style={styles.preset}
              />
            ))}
          </SSHStack>
          <SSTextInput
            size="small"
            placeholder={t('nostrIdentity.note.customAmount')}
            keyboardType="number-pad"
            value={customAmount}
            onChangeText={setCustomAmount}
            returnKeyType="next"
          />
          <SSTextInput
            size="small"
            placeholder={t('nostrIdentity.note.zapCommentPlaceholder')}
            value={comment}
            onChangeText={setComment}
            returnKeyType="done"
            onSubmitEditing={handleCustomSubmit}
          />
          <SSButton
            label={
              customSats > 0
                ? `${t('nostrIdentity.note.zap')} ${privacyMode ? NOSTR_PRIVACY_MASK : customSats.toLocaleString()} sats`
                : t('nostrIdentity.note.zap')
            }
            variant="gradient"
            gradientType="special"
            disabled={customSats === 0}
            onPress={handleCustomSubmit}
          />
          <SSButton
            label={t('common.cancel')}
            variant="ghost"
            onPress={handleCancel}
          />
        </SSVStack>
      </SSBottomSheet>
      <SSPaymentMethodPicker
        ref={paymentSheetRef}
        onSelect={onPaymentMethodSelect}
        methods={paymentMethods}
        amountSats={payAmount}
        btcPrice={btcPrice}
        fiatCurrency={fiatCurrency}
      />
    </>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 24
  },
  preset: {
    flex: 1
  }
})

export default SSNostrZapSheets
