import { useHeaderHeight } from '@react-navigation/elements'
import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { memo, useCallback, useMemo, useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconList } from '@/components/icons'
import SSBubbleChart from '@/components/SSBubbleChart'
import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors, Layout } from '@/styles'
import { type Utxo } from '@/types/models/Utxo'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatNumber } from '@/utils/format'

function SelectUtxoBubbles() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const account = useAccountsStore(
    (state) => state.accounts.find((account) => account.id === id)!
  )
  const useZeroPadding = useSettingsStore((state) => state.useZeroPadding)
  const [inputs, getInputs, hasInput, addInput, removeInput] =
    useTransactionBuilderStore(
      useShallow((state) => [
        state.inputs,
        state.getInputs,
        state.hasInput,
        state.addInput,
        state.removeInput
      ])
    )
  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
  )

  const topHeaderHeight = useHeaderHeight()
  const { width, height } = useWindowDimensions()
  const GRAPH_HEIGHT = height - topHeaderHeight + 20
  const GRAPH_WIDTH = width

  const [customAmountModalVisible, setCustomAmountModalVisible] =
    useState(false)

  const hasSelectedUtxos = inputs.size > 0
  const selectedAllUtxos = inputs.size === account.utxos.length

  const utxosValue = useCallback(
    (utxos: Utxo[]): number => utxos.reduce((acc, utxo) => acc + utxo.value, 0),
    []
  )

  const utxosTotalValue = useMemo(
    () => utxosValue(account.utxos),
    [account.utxos, utxosValue]
  )
  const utxosSelectedValue = utxosValue(getInputs())

  const handleOnToggleSelected = useCallback(
    (utxo: Utxo) => {
      const includesInput = hasInput(utxo)

      if (includesInput) removeInput(utxo)
      else addInput(utxo)
    },
    [hasInput, removeInput, addInput]
  )

  function handleSelectAllUtxos() {
    for (const utxo of account.utxos) {
      addInput(utxo)
    }
  }

  function handleDeselectAllUtxos() {
    for (const utxo of account.utxos) {
      removeInput(utxo)
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        style={styles.absoluteTopContainer}
        locations={[0.185, 0.5554, 0.7713, 1]}
        colors={['#131313F5', '#131313A6', '#1313134B', '#13131300']}
      >
        <SSVStack>
          <SSHStack justifyBetween>
            <SSText color="muted">{t('utxo.group')}</SSText>
            <SSText size="md">
              {t('transaction.build.select.spendableOutputs')}
            </SSText>
            <SSIconButton
              onPress={() =>
                router.navigate(`/account/${id}/signAndSend/selectUtxoList`)
              }
            >
              <SSIconList height={16} width={24} />
            </SSIconButton>
          </SSHStack>
          <SSVStack itemsCenter gap="sm">
            <SSVStack itemsCenter gap="xs">
              <SSText>
                {inputs.size} {t('common.of').toLowerCase()}{' '}
                {account.utxos.length} {t('common.selected').toLowerCase()}
              </SSText>
              <SSHStack gap="xs">
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {t('common.total')}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[75] }}>
                  {formatNumber(utxosTotalValue, 0, useZeroPadding)}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {t('bitcoin.sats').toLowerCase()}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[75] }}>
                  {formatNumber(satsToFiat(utxosTotalValue), 2)}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {fiatCurrency}
                </SSText>
              </SSHStack>
            </SSVStack>
            <SSVStack itemsCenter gap="none">
              <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                <SSText
                  size="7xl"
                  color="white"
                  weight="ultralight"
                  style={{ lineHeight: 62 }}
                >
                  {formatNumber(utxosSelectedValue, 0, useZeroPadding)}
                </SSText>
                <SSText size="xl" color="muted">
                  {t('bitcoin.sats').toLowerCase()}
                </SSText>
              </SSHStack>
              <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                <SSText size="md" color="muted">
                  {formatNumber(satsToFiat(utxosSelectedValue), 2)}
                </SSText>
                <SSText size="xs" style={{ color: Colors.gray[500] }}>
                  {fiatCurrency}
                </SSText>
              </SSHStack>
            </SSVStack>
          </SSVStack>
        </SSVStack>
      </LinearGradient>
      <SSBubbleChart
        utxos={account.utxos}
        canvasSize={{ width: GRAPH_WIDTH, height: GRAPH_HEIGHT }}
        inputs={getInputs()}
        onPress={handleOnToggleSelected}
        style={{ position: 'absolute', top: 40 }}
      />
      <LinearGradient
        locations={[0, 0.1255, 0.2678, 1]}
        style={[styles.absoluteSubmitContainer]}
        colors={['#13131300', '#1313130F', '#1313132A', '#131313']}
      >
        <SSVStack style={{ width: '92%' }}>
          <SSHStack justifyBetween>
            <SSButton
              label={t('transaction.build.select.customAmount')}
              variant="ghost"
              style={{ width: 'auto', height: 'auto' }}
              onPress={() => setCustomAmountModalVisible(true)}
            />
            <SSButton
              label={
                selectedAllUtxos
                  ? t('common.deselectAll')
                  : t('common.selectAll')
              }
              variant="ghost"
              style={{ width: 'auto', height: 'auto' }}
              onPress={() =>
                selectedAllUtxos
                  ? handleDeselectAllUtxos()
                  : handleSelectAllUtxos()
              }
            />
          </SSHStack>
          <SSButton
            label={t('transaction.build.add.inputs.title.2')}
            variant="secondary"
            disabled={!hasSelectedUtxos}
            style={[
              { opacity: 100 },
              !hasSelectedUtxos && {
                backgroundColor: Colors.gray[700]
              }
            ]}
            textStyle={[!hasSelectedUtxos && { color: Colors.gray[400] }]}
            onPress={() =>
              router.navigate(`/account/${id}/signAndSend/ioPreview`)
            }
          />
        </SSVStack>
      </LinearGradient>
      <SSModal
        visible={customAmountModalVisible}
        onClose={() => setCustomAmountModalVisible(false)}
      >
        <SSVStack>
          <SSText size="lg" uppercase center style={{ maxWidth: 240 }}>
            {t('transaction.build.type.customAmount')}
          </SSText>
        </SSVStack>
      </SSModal>
    </View>
  )
}

const styles = StyleSheet.create({
  absoluteTopContainer: {
    width: '100%',
    position: 'absolute',
    paddingHorizontal: Layout.mainContainer.paddingHorizontal,
    paddingTop: Layout.mainContainer.paddingTop,
    zIndex: 20
  },
  absoluteSubmitContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: Colors.transparent,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 20
  }
})

export default memo(SelectUtxoBubbles)
