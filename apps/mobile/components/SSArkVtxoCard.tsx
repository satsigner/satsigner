import { Pressable, StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import type { ArkVtxo } from '@/types/models/Ark'
import { formatTxId } from '@/utils/format'

type SSArkVtxoCardProps = {
  vtxo: ArkVtxo
  selected?: boolean
  onToggle?: (id: string) => void
}

function SSArkVtxoCard({
  vtxo,
  selected = false,
  onToggle
}: SSArkVtxoCardProps) {
  const [currencyUnit, privacyMode, useZeroPadding] = useSettingsStore(
    useShallow((state) => [
      state.currencyUnit,
      state.privacyMode,
      state.useZeroPadding
    ])
  )

  const selectable = onToggle !== undefined

  const content = (
    <SSHStack
      justifyBetween
      style={[styles.container, !vtxo.spendable && styles.locked]}
      gap="sm"
    >
      <SSHStack gap="sm" style={styles.leftColumn}>
        {selectable ? (
          <View
            style={[styles.checkbox, selected && styles.checkboxSelected]}
          />
        ) : null}
        <SSVStack gap="xxs" style={styles.leftColumn}>
          <SSHStack gap="xs" style={styles.amountRow}>
            {privacyMode ? (
              <SSText size="lg" weight="light">
                ••••
              </SSText>
            ) : (
              <SSStyledSatText
                amount={vtxo.amountSats}
                decimals={0}
                useZeroPadding={useZeroPadding}
                currency={currencyUnit}
                textSize="lg"
                weight="light"
                noColor
              />
            )}
            <SSText color="muted" size="xs">
              {currencyUnit === 'btc' ? t('bitcoin.btc') : t('bitcoin.sats')}
            </SSText>
          </SSHStack>
          <SSText size="xxs" style={styles.id} numberOfLines={1}>
            {formatTxId(vtxo.id)}
          </SSText>
        </SSVStack>
      </SSHStack>
      <SSVStack gap="xxs" style={styles.rightColumn}>
        <SSText size="xs" color="muted" uppercase>
          {vtxo.spendable ? t('ark.vtxo.spendable') : t('ark.vtxo.locked')}
        </SSText>
        <SSText size="xxs" style={styles.expiry}>
          {t('ark.vtxo.expiry', { height: vtxo.expiryHeight })}
        </SSText>
      </SSVStack>
    </SSHStack>
  )

  if (!selectable) {
    return content
  }

  return <Pressable onPress={() => onToggle(vtxo.id)}>{content}</Pressable>
}

const styles = StyleSheet.create({
  amountRow: {
    alignItems: 'baseline'
  },
  checkbox: {
    alignSelf: 'center',
    borderColor: Colors.gray[500],
    borderRadius: 4,
    borderWidth: 1,
    height: 18,
    width: 18
  },
  checkboxSelected: {
    backgroundColor: Colors.white,
    borderColor: Colors.white
  },
  container: {
    alignItems: 'flex-start',
    paddingBottom: 10,
    paddingTop: 10
  },
  expiry: {
    color: Colors.gray[400],
    textAlign: 'right'
  },
  id: {
    color: Colors.gray[400]
  },
  leftColumn: {
    flexShrink: 1
  },
  locked: {
    opacity: 0.5
  },
  rightColumn: {
    alignItems: 'flex-end'
  }
})

export default SSArkVtxoCard
