import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import SSButton from '@/components/SSButton'
import SSFeeInput from '@/components/SSFeeInput'
import SSText from '@/components/SSText'
import { useDisplayPreferences } from '@/hooks/useDisplayPreferences'
import { useTransactionFeeReplacement } from '@/hooks/useTransactionFeeReplacement'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { type FeeReplacementKind } from '@/types/models/FeeReplacement'
import { type FeeReplacementSearchParams } from '@/types/navigation/searchParams'
import { parseFeeReplacementKind } from '@/utils/feeReplacement'
import { estimateTargetBlocks } from '@/utils/feeWarnings'

import { SSTxDetailsHeader } from '.'

const TITLE_KEYS: Record<FeeReplacementKind, string> = {
  bump: 'transaction.feeReplacement.bump',
  cancel: 'transaction.feeReplacement.cancel.action',
  cpfp: 'transaction.feeReplacement.cpfp'
}

const NOTE_KEYS: Record<FeeReplacementKind, string> = {
  bump: 'transaction.feeReplacement.note.bump',
  cancel: 'transaction.feeReplacement.note.cancel',
  cpfp: 'transaction.feeReplacement.note.cpfp'
}

const CONFIRM_KEYS: Record<FeeReplacementKind, string> = {
  bump: 'common.continue',
  cancel: 'transaction.feeReplacement.cancel.confirm',
  cpfp: 'common.continue'
}

function goBack() {
  router.back()
}

function FeeReplacement() {
  const {
    id: accountId,
    kind: kindParam,
    txid
  } = useLocalSearchParams<FeeReplacementSearchParams>()
  const kind = parseFeeReplacementKind(kindParam)
  const {
    defaultFeeRate,
    draftInProgress,
    feeEstimateVsize,
    feeRateInputMax,
    feeRateSliderMax,
    isAvailable,
    isBuilding,
    minFeeRate,
    nextBlockFee,
    submitFeeReplacement,
    tx
  } = useTransactionFeeReplacement({ accountId, kind, txid })
  const { btcPrice, fiatCurrency, fiatEnabled } = useDisplayPreferences()
  const [feeRate, setFeeRate] = useState<number>()

  if (!kind || !tx || !isAvailable) {
    return (
      <Redirect
        href={`/signer/bitcoin/account/${accountId}/transaction/${txid}`}
      />
    )
  }

  const selectedFeeRate = feeRate ?? defaultFeeRate

  function handleContinue() {
    submitFeeReplacement(selectedFeeRate)
  }

  return (
    <SSScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{t(TITLE_KEYS[kind])}</SSText>
        }}
      />
      <SSVStack gap="lg" style={{ padding: 20 }}>
        <SSTxDetailsHeader tx={tx} />
        <SSText color="muted">{t(NOTE_KEYS[kind])}</SSText>
        {draftInProgress ? (
          <SSText>{t('transaction.feeReplacement.draftWarning')}</SSText>
        ) : null}
        <SSFeeInput
          value={selectedFeeRate}
          onValueChange={setFeeRate}
          vbytes={feeEstimateVsize}
          min={minFeeRate}
          max={feeRateSliderMax}
          inputMax={feeRateInputMax}
          estimatedBlock={estimateTargetBlocks(selectedFeeRate, nextBlockFee)}
          fiatCurrency={fiatCurrency}
          btcPrice={btcPrice}
          fiatEnabled={fiatEnabled}
        />
        <SSVStack gap="sm">
          <SSButton
            variant={kind === 'cancel' ? 'danger' : 'secondary'}
            label={t(CONFIRM_KEYS[kind])}
            loading={isBuilding}
            disabled={isBuilding}
            onPress={handleContinue}
          />
          <SSButton
            variant="ghost"
            label={t('common.cancel')}
            onPress={goBack}
          />
        </SSVStack>
      </SSVStack>
    </SSScrollView>
  )
}

export default FeeReplacement
