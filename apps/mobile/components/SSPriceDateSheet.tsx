import type { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { StyleSheet, View } from 'react-native'

import SSBottomSheet from '@/components/SSBottomSheet'
import SSButton from '@/components/SSButton'
import SSDatePicker from '@/components/SSDatePicker'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors, Sizes } from '@/styles'
import type { Currency } from '@/types/models/Blockchain'
import { formatDate, formatNumber } from '@/utils/format'

const PRICE_HISTORY_START_YEAR = 2011
const DATE_PICKER_HEIGHT = 160
const DATE_PICKER_MARK_HEIGHT = 40
const SHEET_SNAP_POINTS = ['62%']

type SSPriceDateSheetProps = {
  ref: React.Ref<BottomSheetMethods>
  date: Date
  pickerKey: number
  currency: Currency
  price?: number
  isLoading: boolean
  isHistoricalEnabled: boolean
  onDateChange: (date: Date) => void
  onApply: () => void
  onUseCurrentPrice: () => void
  onOpenPriceSettings: () => void
}

function getRateMessage({
  currency,
  isHistoricalEnabled,
  isLoading,
  price
}: Pick<
  SSPriceDateSheetProps,
  'currency' | 'isHistoricalEnabled' | 'isLoading' | 'price'
>) {
  if (!isHistoricalEnabled) {
    return t('receive.priceDate.historicalOff')
  }
  if (isLoading) {
    return t('receive.priceDate.loading')
  }
  if (price === undefined) {
    return t('receive.priceDate.unavailable')
  }
  return t('receive.priceDate.rate', {
    currency,
    price: formatNumber(price)
  })
}

function SSPriceDateSheet({
  ref,
  date,
  pickerKey,
  currency,
  price,
  isLoading,
  isHistoricalEnabled,
  onDateChange,
  onApply,
  onUseCurrentPrice,
  onOpenPriceSettings
}: SSPriceDateSheetProps) {
  return (
    <SSBottomSheet
      ref={ref}
      title={t('receive.priceDate.title')}
      snapPoints={SHEET_SNAP_POINTS}
      scrollable={false}
    >
      <SSVStack gap="md">
        <View style={styles.pickerWrap}>
          <SSDatePicker
            key={pickerKey}
            value={date}
            onChange={onDateChange}
            width="90%"
            height={DATE_PICKER_HEIGHT}
            fontSize={Sizes.text.fontSize.xl}
            textColor={Colors.white}
            fadeColor={Colors.gray[950]}
            markColor={Colors.gray[950]}
            markHeight={DATE_PICKER_MARK_HEIGHT}
            startYear={PRICE_HISTORY_START_YEAR}
          />
        </View>
        <SSVStack gap="xxs">
          <SSText center color="muted" size="sm">
            {formatDate(date)}
          </SSText>
          <SSText center>
            {getRateMessage({
              currency,
              isHistoricalEnabled,
              isLoading,
              price
            })}
          </SSText>
        </SSVStack>
        {isHistoricalEnabled ? (
          <SSButton
            label={t('receive.priceDate.apply')}
            variant="secondary"
            disabled={price === undefined}
            onPress={onApply}
          />
        ) : (
          <SSButton
            label={t('receive.priceDate.openSettings')}
            variant="secondary"
            onPress={onOpenPriceSettings}
          />
        )}
        <SSButton
          label={t('receive.priceDate.useCurrent')}
          variant="ghost"
          onPress={onUseCurrentPrice}
        />
      </SSVStack>
    </SSBottomSheet>
  )
}

const styles = StyleSheet.create({
  pickerWrap: { alignItems: 'center' }
})

export default SSPriceDateSheet
