import { useHeaderHeight } from '@react-navigation/elements'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { memo, useCallback, useMemo, useState } from 'react'
import { StyleSheet, useWindowDimensions } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useShallow } from 'zustand/react/shallow'

import { SSIconList } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import SSUtxoBubbles from '@/components/SSUtxoBubbles'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { usePriceStore } from '@/store/price'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors, Layout } from '@/styles'
import { type Utxo } from '@/types/models/Utxo'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatNumber } from '@/utils/format'

export default memo(SelectUtxoBubbles)

function SelectUtxoBubbles() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const getCurrentAccount = useAccountsStore((state) => state.getCurrentAccount)
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

  const account = getCurrentAccount(id)! // Make use of non-null assertion operator for now

  const topHeaderHeight = useHeaderHeight()
  const { width, height } = useWindowDimensions()
  const GRAPH_HEIGHT = height - topHeaderHeight + 20
  const GRAPH_WIDTH = width

  const [customAmountModalVisible, setCustomAmountModalVisible] = useState(true)

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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{account.name}</SSText>
        }}
      />
      <LinearGradient
        style={styles.absoluteTopContainer}
        locations={[0.185, 0.5554, 0.7713, 1]}
        colors={['#000000F5', '#000000A6', '#0000004B', '#00000000']}
      >
        <SSVStack>
          <SSHStack justifyBetween>
            <SSText color="muted">Group</SSText>
            <SSText size="md">
              {i18n.t('signAndSend.selectSpendableOutputs')}
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
                {inputs.size} {i18n.t('common.of').toLowerCase()}{' '}
                {account.utxos.length} {i18n.t('common.selected').toLowerCase()}
              </SSText>
              <SSHStack gap="xs">
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {i18n.t('common.total')}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[75] }}>
                  {formatNumber(utxosTotalValue)}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {i18n.t('bitcoin.sats').toLowerCase()}
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
                  {formatNumber(utxosSelectedValue)}
                </SSText>
                <SSText size="xl" color="muted">
                  {i18n.t('bitcoin.sats').toLowerCase()}
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
      <SSUtxoBubbles
        utxos={account.utxos}
        canvasSize={{ width: GRAPH_WIDTH, height: GRAPH_HEIGHT }}
        inputs={getInputs()}
        onPress={handleOnToggleSelected}
        style={{ position: 'absolute', top: 40 }}
      />
      <LinearGradient
        locations={[0, 0.1255, 0.2678, 1]}
        style={[styles.absoluteSubmitContainer]}
        colors={['#00000000', '#0000000F', '#0000002A', '#000000']}
      >
        <SSVStack style={{ width: '92%' }}>
          <SSHStack justifyBetween>
            <SSButton
              label={i18n.t('signAndSend.customAmount')}
              variant="ghost"
              style={{ width: 'auto', height: 'auto' }}
              onPress={() => setCustomAmountModalVisible(true)}
            />
            <SSButton
              label={
                selectedAllUtxos
                  ? i18n.t('signAndSend.deselectAll')
                  : i18n.t('signAndSend.selectAll')
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
            label={i18n.t('signAndSend.addAsInputToMessage')}
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
          <SSText size="lg" center style={{ maxWidth: 240 }}>
            TYPE CUSTOM AMOUNT FOR AUTOMATIC SELECTION
          </SSText>
        </SSVStack>
      </SSModal>
    </GestureHandlerRootView>
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
