import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { type Utxo } from '@/types/models/Utxo'
import { formatAddress, formatDate, formatNumber } from '@/utils/format'
import { normalizeUtxoLabelForDisplay } from '@/utils/parse'

import { SSIconExclude, SSIconPlus, SSIconX } from './icons'
import SSIconButton from './SSIconButton'
import SSStyledSatText from './SSStyledSatText'
import SSText from './SSText'
import SSUtxoSizeMeter from './SSUtxoSizeMeter'

type SSUtxoItemProps = {
  utxo: Utxo
  selected?: boolean
  largestValue: number
  onToggleSelected?: (utxo: Utxo) => void
  onToggleExcluded?: (utxo: Utxo) => void
  addressIndex?: number
  mode?: 'select' | 'readonly'
  excluded?: boolean
}

function SSUtxoItem({
  utxo,
  selected = false,
  largestValue,
  onToggleSelected,
  onToggleExcluded,
  addressIndex,
  mode = 'select',
  excluded = false
}: SSUtxoItemProps) {
  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((s) => [s.fiatCurrency, s.satsToFiat])
  )
  const [currencyUnit, useZeroPadding] = useSettingsStore(
    useShallow((state) => [state.currencyUnit, state.useZeroPadding])
  )
  const label = normalizeUtxoLabelForDisplay(utxo.label || '')
  const readonly = mode === 'readonly'

  const body = (
    <SSVStack
      gap="xs"
      style={[styles.body, excluded ? styles.bodyExcluded : undefined]}
    >
      <SSHStack justifyBetween>
        <SSHStack style={styles.details}>
          {readonly ? null : (
            <View
              style={[
                styles.selectIconBase,
                { backgroundColor: selected ? Colors.error : Colors.gray[500] }
              ]}
            >
              {selected ? (
                <SSIconX height={8} width={8} />
              ) : (
                <SSIconPlus height={8} width={8} />
              )}
            </View>
          )}
          <SSVStack gap="xs">
            <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
              <SSStyledSatText
                amount={utxo.value}
                decimals={0}
                useZeroPadding={useZeroPadding}
                currency={currencyUnit}
                textSize="md"
              />
              <SSText size="xs" color="muted">
                {currencyUnit === 'btc' ? t('bitcoin.btc') : t('bitcoin.sats')}
              </SSText>
            </SSHStack>
            <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
              <SSText color="white">
                {formatNumber(satsToFiat(utxo.value), 2)}
              </SSText>
              <SSText color="muted">{fiatCurrency}</SSText>
            </SSHStack>
          </SSVStack>
        </SSHStack>
        <SSVStack gap="xs" style={styles.meta}>
          <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
            <SSText>
              {utxo.addressTo ? formatAddress(utxo.addressTo) : ''}
            </SSText>
            {typeof addressIndex === 'number' && (
              <SSText color="muted" size="sm">
                ({addressIndex})
              </SSText>
            )}
          </SSHStack>
          <SSText style={{ alignSelf: 'flex-end', color: Colors.gray[100] }}>
            {utxo.timestamp ? formatDate(utxo.timestamp) : ''}
          </SSText>
        </SSVStack>
      </SSHStack>
      <SSText color={label ? 'white' : 'muted'}>
        {label || t('utxo.noLabel')}
      </SSText>
    </SSVStack>
  )

  return (
    <View>
      <SSHStack style={{ alignItems: 'stretch' }}>
        {readonly || !onToggleSelected ? (
          body
        ) : (
          <TouchableOpacity
            style={styles.pressable}
            onPress={() => {
              if (excluded && !selected) {
                return
              }
              onToggleSelected(utxo)
            }}
            onLongPress={
              onToggleExcluded ? () => onToggleExcluded(utxo) : undefined
            }
          >
            {body}
          </TouchableOpacity>
        )}
        {onToggleExcluded && !readonly ? (
          <SSIconButton
            onPress={() => onToggleExcluded(utxo)}
            style={styles.excludeButton}
          >
            <SSIconExclude
              height={16}
              width={16}
              stroke={excluded ? Colors.mainRed : Colors.gray[500]}
            />
          </SSIconButton>
        ) : null}
      </SSHStack>
      <SSUtxoSizeMeter
        size={utxo.value}
        largestSize={largestValue}
        selected={selected}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: '5%',
    paddingVertical: 16
  },
  bodyExcluded: {
    opacity: 0.45
  },
  details: {
    flexShrink: 1
  },
  excludeButton: {
    justifyContent: 'center',
    paddingRight: '5%'
  },
  meta: {
    alignSelf: 'flex-start',
    flexShrink: 0
  },
  pressable: {
    flex: 1,
    minWidth: 0
  },
  selectIconBase: {
    alignItems: 'center',
    alignSelf: 'baseline',
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    marginTop: 2,
    width: 20
  }
})

export default SSUtxoItem
