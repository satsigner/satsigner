import { FlashList } from '@shopify/flash-list'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSCheckbox from '@/components/SSCheckbox'
import SSPaste from '@/components/SSPaste'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useArkOffboard } from '@/hooks/useArkOffboard'
import { useArkOffboardFeeEstimate } from '@/hooks/useArkOffboardFeeEstimate'
import { useArkSpendableVtxos } from '@/hooks/useArkSpendableVtxos'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useArkStore } from '@/store/ark'
import { usePriceStore } from '@/store/price'
import { Colors } from '@/styles'
import type { ArkVtxo } from '@/types/models/Ark'
import { bitcoinjsNetwork } from '@/utils/bitcoin'
import { type DetectedContent } from '@/utils/contentDetector'
import { formatAddress, formatFiatPrice, formatNumber } from '@/utils/format'
import { validateAddress } from '@/utils/validation'

const OFFBOARD_CONTEXT = 'bitcoin' as const
const VTXO_ID_TRUNCATE_CHARS = 8

function sumVtxoSats(vtxos: ArkVtxo[], selected: Set<string>): number {
  return vtxos.reduce(
    (acc, vtxo) => (selected.has(vtxo.id) ? acc + vtxo.amountSats : acc),
    0
  )
}

export default function ArkSendOffboardPage() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [accounts] = useArkStore(useShallow((state) => [state.accounts]))
  const account = accounts.find((a) => a.id === id)
  const network = account?.network
  const [btcPrice, fiatCurrency] = usePriceStore(
    useShallow((state) => [state.btcPrice, state.fiatCurrency])
  )

  const vtxosQuery = useArkSpendableVtxos(id)
  const offboardMutation = useArkOffboard(id)

  const [address, setAddress] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [cameraVisible, setCameraVisible] = useState(false)
  const [pasteVisible, setPasteVisible] = useState(false)

  const vtxos = vtxosQuery.data ?? []
  const selectedArray = Array.from(selectedIds)
  const selectedAmount = sumVtxoSats(vtxos, selectedIds)
  const trimmedAddress = address.trim()
  const addressValid =
    trimmedAddress.length > 0 &&
    network !== undefined &&
    validateAddress(trimmedAddress, bitcoinjsNetwork(network))

  const feeEstimateQuery = useArkOffboardFeeEstimate({
    accountId: id,
    bitcoinAddress: trimmedAddress,
    network,
    vtxoIds: selectedArray
  })
  const feeSats = feeEstimateQuery.data?.feeSats

  const allSelected = vtxos.length > 0 && selectedIds.size === vtxos.length
  const canConfirm =
    addressValid &&
    selectedIds.size > 0 &&
    !offboardMutation.isPending &&
    feeSats !== undefined

  function toggleVtxo(vtxoId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(vtxoId)) {
        next.delete(vtxoId)
      } else {
        next.add(vtxoId)
      }
      return next
    })
  }

  function handleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set())
      return
    }
    setSelectedIds(new Set(vtxos.map((v) => v.id)))
  }

  function handleAddressContent(content: DetectedContent) {
    setCameraVisible(false)
    setPasteVisible(false)
    setAddress((content.cleaned ?? content.raw ?? '').trim())
  }

  function handleConfirm() {
    if (!addressValid) {
      toast.error(t('ark.offboard.error.invalidAddress'))
      return
    }
    if (selectedIds.size === 0) {
      toast.error(t('ark.offboard.error.noSelection'))
      return
    }
    if (feeSats === undefined) {
      return
    }
    offboardMutation.mutate(
      {
        bitcoinAddress: trimmedAddress,
        vtxoIds: selectedArray
      },
      {
        onError: (error) => {
          const message =
            error instanceof Error
              ? error.message
              : t('ark.offboard.error.generic')
          toast.error(message)
        },
        onSuccess: () => {
          toast.success(t('ark.offboard.success'))
          router.replace({
            params: { id },
            pathname: '/signer/ark/account/[id]'
          })
        }
      }
    )
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('ark.offboard.title')}</SSText>
          )
        }}
      />
      <SSVStack gap="lg" style={styles.container}>
        <SSText color="muted" size="xs">
          {t('ark.offboard.description')}
        </SSText>

        <SSVStack gap="xs">
          <SSText color="muted" size="xs" uppercase>
            {t('ark.offboard.address')}
          </SSText>
          <SSTextInput
            align="left"
            value={address}
            onChangeText={setAddress}
            multiline
            numberOfLines={2}
            style={styles.addressInput}
          />
          <SSHStack gap="sm">
            <SSButton
              label={t('ark.send.paste')}
              onPress={() => setPasteVisible(true)}
              variant="subtle"
              style={styles.actionButton}
            />
            <SSButton
              label={t('ark.send.scan')}
              onPress={() => setCameraVisible(true)}
              variant="subtle"
              style={styles.actionButton}
            />
          </SSHStack>
          {address.length > 0 && !addressValid && (
            <SSText size="xs" style={{ color: Colors.warning }}>
              {t('ark.offboard.error.invalidAddress')}
            </SSText>
          )}
        </SSVStack>
        <SSVStack gap="xs" style={styles.vtxoSection}>
          <SSHStack justifyBetween>
            <SSText color="muted" size="xs" uppercase>
              {t('ark.offboard.vtxos')}
            </SSText>
            {vtxos.length > 0 && (
              <SSText
                size="xs"
                onPress={handleSelectAll}
                style={styles.selectToggle}
              >
                {allSelected
                  ? t('ark.offboard.clearAll')
                  : t('ark.offboard.selectAll')}
              </SSText>
            )}
          </SSHStack>
          {vtxosQuery.isLoading && (
            <SSText color="muted" size="xs">
              {t('common.loading')}
            </SSText>
          )}
          {vtxosQuery.error && !vtxosQuery.isLoading && (
            <SSText size="xs" style={{ color: Colors.warning }}>
              {t('ark.offboard.error.load')}
            </SSText>
          )}
          {!vtxosQuery.isLoading && vtxos.length === 0 && (
            <SSText color="muted" size="xs">
              {t('ark.offboard.noVtxos')}
            </SSText>
          )}
          <View style={styles.vtxoList}>
            <FlashList
              data={vtxos}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const truncatedId = formatAddress(
                  item.id,
                  VTXO_ID_TRUNCATE_CHARS
                )
                const description =
                  btcPrice > 0
                    ? `${formatFiatPrice(item.amountSats, btcPrice)} ${fiatCurrency}`
                    : ''
                return (
                  <View style={styles.vtxoItem}>
                    <View style={styles.vtxoMain}>
                      <SSCheckbox
                        selected={selectedIds.has(item.id)}
                        onPress={() => toggleVtxo(item.id)}
                        label={`${formatNumber(item.amountSats)} ${t('bitcoin.sats')}`}
                        description={description}
                        labelProps={{ color: 'white', size: 'sm' }}
                      />
                    </View>
                    <SSVStack gap="xs">
                      <SSText color="muted" size="xs" style={styles.vtxoState}>
                        {item.state}
                      </SSText>
                      <SSText
                        color="muted"
                        size="xs"
                        style={{ textAlign: 'right' }}
                      >
                        {truncatedId}
                      </SSText>
                    </SSVStack>
                  </View>
                )
              }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        </SSVStack>
        {selectedIds.size > 0 && (
          <SSVStack gap="xs">
            <SSText color="muted" size="xs">
              {t('ark.offboard.selectedSummary', {
                amount: formatNumber(selectedAmount),
                count: selectedIds.size
              })}
            </SSText>
            {addressValid && (
              <SSHStack justifyBetween>
                <SSText color="muted" size="xs" uppercase>
                  {t('ark.offboard.fee')}
                </SSText>
                {feeSats !== undefined ? (
                  <SSText size="xs">
                    {formatNumber(feeSats)} {t('bitcoin.sats')}
                  </SSText>
                ) : feeEstimateQuery.isPending ? (
                  <SSText color="muted" size="xs">
                    {t('ark.offboard.feeEstimating')}
                  </SSText>
                ) : feeEstimateQuery.error ? (
                  <SSText size="xs" style={{ color: Colors.warning }}>
                    {t('ark.offboard.feeUnavailable')}
                  </SSText>
                ) : null}
              </SSHStack>
            )}
          </SSVStack>
        )}
        <SSHStack gap="sm" style={styles.confirmRow}>
          <SSButton
            label={t('common.cancel')}
            onPress={() => router.back()}
            variant="ghost"
            style={styles.actionButton}
            disabled={offboardMutation.isPending}
          />
          <SSButton
            label={t('ark.offboard.confirm')}
            onPress={handleConfirm}
            loading={offboardMutation.isPending}
            disabled={!canConfirm}
            variant="secondary"
            style={styles.actionButton}
          />
        </SSHStack>
      </SSVStack>
      <SSCameraModal
        visible={cameraVisible}
        onClose={() => setCameraVisible(false)}
        onContentScanned={handleAddressContent}
        context={OFFBOARD_CONTEXT}
        title={t('ark.offboard.address')}
      />
      <SSPaste
        visible={pasteVisible}
        onClose={() => setPasteVisible(false)}
        onContentPasted={handleAddressContent}
        context={OFFBOARD_CONTEXT}
      />
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  actionButton: {
    flex: 1
  },
  addressInput: {
    height: 80,
    textAlignVertical: 'top'
  },
  confirmRow: {
    marginTop: 8
  },
  container: {
    flex: 1,
    paddingBottom: 20,
    paddingTop: 20
  },
  selectToggle: {
    color: Colors.gray[300],
    textDecorationLine: 'underline'
  },
  separator: {
    backgroundColor: Colors.gray[800],
    height: StyleSheet.hairlineWidth
  },
  vtxoItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10
  },
  vtxoList: {
    flex: 1
  },
  vtxoMain: {
    flex: 1
  },
  vtxoSection: {
    flex: 1,
    minHeight: 0
  },
  vtxoState: {
    textAlign: 'right',
    textTransform: 'uppercase'
  }
})
