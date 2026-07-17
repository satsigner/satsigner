import * as Clipboard from 'expo-clipboard'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'

import SSAmountInput from '@/components/SSAmountInput'
import SSButton from '@/components/SSButton'
import SSPairedTabs from '@/components/SSPairedTabs'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { DUST_LIMIT } from '@/constants/btc'
import { LIGHTNING_CHANNEL_THRESHOLD } from '@/constants/lightning'
import {
  useArkAutoBoard,
  useArkOnchainAddress,
  useArkPendingBoards,
  useArkServerInfo
} from '@/hooks/useArkBoard'
import {
  useArkAddress,
  useArkBolt11InvoiceMutation
} from '@/hooks/useArkReceive'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { formatAddress, formatNumber } from '@/utils/format'

type ReceiveTab = 'ark' | 'lightning' | 'onchain'

const TXID_TRUNCATE_CHARS = 8

async function copyToClipboard(value: string) {
  try {
    await Clipboard.setStringAsync(value)
    toast.success(t('common.copiedToClipboard'))
  } catch {
    toast.error(t('ecash.error.failedToCopy'))
  }
}

function handleBoarded() {
  toast.success(t('ark.board.success'))
}

export default function ArkReceivePage() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<ReceiveTab>('ark')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')

  const addressQuery = useArkAddress(id)
  const invoiceMutation = useArkBolt11InvoiceMutation(id)
  const onchainAddressQuery = useArkOnchainAddress(id)
  const pendingBoardsQuery = useArkPendingBoards(id)
  const serverInfoQuery = useArkServerInfo(id)
  const autoBoard = useArkAutoBoard({
    accountId: id,
    enabled: activeTab === 'onchain',
    onBoarded: handleBoarded
  })

  const pendingBoards = pendingBoardsQuery.data ?? []
  const requiredConfirmations = serverInfoQuery.data?.requiredBoardConfirmations

  const invoice = invoiceMutation.data
  const amountSats = Number(amount || 0)
  const canCreateInvoice = amountSats > 0 && !invoiceMutation.isPending

  function handleGenerateNewAddress() {
    addressQuery.refetch()
  }

  function handleCopyAddress() {
    const address = addressQuery.data
    if (!address) {
      return
    }
    copyToClipboard(address)
  }

  function handleCopyOnchainAddress() {
    const address = onchainAddressQuery.data
    if (!address) {
      return
    }
    copyToClipboard(address)
  }

  function handleCreateInvoice() {
    if (amountSats <= 0) {
      toast.error(t('ark.error.invalidAmount'))
      return
    }
    const trimmedDescription = description.trim()
    invoiceMutation.mutate(
      {
        amountSats,
        description: trimmedDescription || undefined
      },
      {
        onError: (error) => {
          const reason = error instanceof Error ? error.message : 'unknown'
          toast.error(`${t('ark.error.invoiceGeneration')}: ${reason}`)
        }
      }
    )
  }

  function handleResetInvoice() {
    invoiceMutation.reset()
    setDescription('')
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{t('ark.receive.title')}</SSText>
        }}
      />
      <ScrollView>
        <SSVStack gap="lg" style={styles.container}>
          <SSPairedTabs<ReceiveTab>
            activeTab={activeTab}
            primary={{ key: 'ark', label: t('ark.receive.arkTab') }}
            secondary={{
              key: 'lightning',
              label: t('ark.receive.lightningTab')
            }}
            tertiary={{
              key: 'onchain',
              label: t('ark.receive.onchainTab')
            }}
            onChange={setActiveTab}
          />
          {activeTab === 'ark' && (
            <SSVStack gap="md">
              {addressQuery.isLoading && (
                <SSText color="muted" center>
                  {t('common.loading')}
                </SSText>
              )}
              {addressQuery.error && (
                <SSText style={{ color: Colors.warning }} center>
                  {t('ark.error.addressGeneration')}
                </SSText>
              )}
              {addressQuery.data && (
                <>
                  <View style={styles.qrContainer}>
                    <SSQRCode value={addressQuery.data} size={280} />
                  </View>
                  <View style={styles.addressBox}>
                    <SSText size="sm" style={styles.monospace}>
                      {addressQuery.data}
                    </SSText>
                  </View>
                  <SSButton
                    label={t('common.copy')}
                    onPress={handleCopyAddress}
                    variant="outline"
                  />
                  <SSButton
                    label={t('ark.receive.generateNewAddress')}
                    onPress={handleGenerateNewAddress}
                    loading={addressQuery.isFetching}
                    variant="subtle"
                  />
                </>
              )}
            </SSVStack>
          )}
          {activeTab === 'lightning' && (
            <SSVStack gap="md">
              {!invoice && (
                <>
                  <SSVStack gap="xs">
                    <SSText color="muted" size="xs" uppercase>
                      {t('ark.receive.amount')} ({t('bitcoin.sats')})
                    </SSText>
                    <SSAmountInput
                      min={DUST_LIMIT}
                      max={LIGHTNING_CHANNEL_THRESHOLD}
                      value={Number(amount)}
                      onValueChange={(value) => setAmount(`${value}`)}
                    />
                  </SSVStack>
                  <SSVStack gap="xs">
                    <SSText color="muted" size="xs" uppercase>
                      {t('ark.receive.description')}
                    </SSText>
                    <SSTextInput
                      align="left"
                      value={description}
                      onChangeText={setDescription}
                      placeholder={t('ark.receive.descriptionPlaceholder')}
                    />
                  </SSVStack>
                  <SSButton
                    label={t('ark.receive.createInvoice')}
                    onPress={handleCreateInvoice}
                    loading={invoiceMutation.isPending}
                    variant="gradient"
                    gradientType="special"
                    disabled={!canCreateInvoice}
                  />
                </>
              )}
              {invoice && (
                <>
                  <View style={styles.qrContainer}>
                    <SSQRCode value={invoice.invoice} size={280} />
                  </View>
                  <View style={styles.addressBox}>
                    <SSText size="sm" style={styles.monospace}>
                      {invoice.invoice}
                    </SSText>
                  </View>
                  <SSText color="muted" size="sm" center>
                    {formatNumber(invoice.amountSats)} {t('bitcoin.sats')}
                  </SSText>
                  <SSButton
                    label={t('common.copy')}
                    onPress={() => copyToClipboard(invoice.invoice)}
                    variant="outline"
                  />
                  <SSButton
                    label={t('ark.receive.newInvoice')}
                    onPress={handleResetInvoice}
                    variant="subtle"
                  />
                </>
              )}
            </SSVStack>
          )}
          {activeTab === 'onchain' && (
            <SSVStack gap="md">
              <SSText color="muted" size="xs">
                {t('ark.receive.onchain.description')}
              </SSText>
              {onchainAddressQuery.isLoading && (
                <SSText color="muted" center>
                  {t('common.loading')}
                </SSText>
              )}
              {onchainAddressQuery.error && !onchainAddressQuery.isLoading && (
                <SSText
                  style={{ color: Colors.warning }}
                  center
                  onPress={() => onchainAddressQuery.refetch()}
                >
                  {t('ark.board.error.loadAddress')}
                </SSText>
              )}
              {onchainAddressQuery.data && (
                <>
                  <View style={styles.qrContainer}>
                    <SSQRCode value={onchainAddressQuery.data} size={280} />
                  </View>
                  <View style={styles.addressBox}>
                    <SSText size="sm" style={styles.monospace}>
                      {onchainAddressQuery.data}
                    </SSText>
                  </View>
                  <SSButton
                    label={t('common.copy')}
                    onPress={handleCopyOnchainAddress}
                    variant="outline"
                  />
                </>
              )}
              {autoBoard.minAmountSats !== undefined && (
                <SSText color="muted" size="xs" center>
                  {t('ark.receive.onchain.minAmount', {
                    amount: formatNumber(autoBoard.minAmountSats),
                    unit: t('bitcoin.sats')
                  })}
                </SSText>
              )}
              {autoBoard.status === 'waitingForFunds' && (
                <SSText color="muted" size="sm" center>
                  {t('ark.receive.onchain.waitingForFunds')}
                </SSText>
              )}
              {autoBoard.status === 'waitingConfirmation' && (
                <SSText color="muted" size="sm" center>
                  {t('ark.receive.onchain.waitingConfirmation', {
                    amount: formatNumber(autoBoard.pendingSats),
                    unit: t('bitcoin.sats')
                  })}
                </SSText>
              )}
              {autoBoard.status === 'belowMinimum' && (
                <SSText size="sm" style={{ color: Colors.warning }} center>
                  {t('ark.receive.onchain.belowMinimum', {
                    amount: formatNumber(autoBoard.confirmedSats),
                    unit: t('bitcoin.sats')
                  })}
                </SSText>
              )}
              {(autoBoard.status === 'readyToBoard' ||
                autoBoard.status === 'boarding') && (
                <SSText color="muted" size="sm" center>
                  {t('ark.receive.onchain.boarding')}
                </SSText>
              )}
              {autoBoard.status === 'failed' && (
                <SSVStack gap="sm">
                  <SSText size="sm" style={{ color: Colors.warning }} center>
                    {t('ark.receive.onchain.failed')}
                  </SSText>
                  <SSButton
                    label={t('ark.receive.onchain.retry')}
                    onPress={autoBoard.retry}
                    variant="subtle"
                  />
                </SSVStack>
              )}
              {pendingBoards.length > 0 && (
                <SSVStack gap="xs">
                  <SSText color="muted" size="xs" uppercase>
                    {t('ark.board.pendingTitle')}
                  </SSText>
                  {requiredConfirmations !== undefined && (
                    <SSText color="muted" size="xs">
                      {t('ark.board.pendingConfirmations', {
                        count: requiredConfirmations
                      })}
                    </SSText>
                  )}
                  {pendingBoards.map((pendingBoard) => (
                    <SSHStack
                      key={pendingBoard.vtxoId}
                      justifyBetween
                      style={styles.pendingRow}
                    >
                      <SSText size="sm">
                        {formatNumber(pendingBoard.amountSats)}{' '}
                        {t('bitcoin.sats')}
                      </SSText>
                      <SSText color="muted" size="xs" style={styles.monospace}>
                        {formatAddress(pendingBoard.txid, TXID_TRUNCATE_CHARS)}
                      </SSText>
                    </SSHStack>
                  ))}
                </SSVStack>
              )}
            </SSVStack>
          )}
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  addressBox: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[800],
    borderRadius: 8,
    borderWidth: 1,
    padding: 12
  },
  container: {
    paddingBottom: 60,
    paddingTop: 20
  },
  monospace: {
    fontFamily: 'monospace'
  },
  pendingRow: {
    borderBottomColor: Colors.gray[800],
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 20
  }
})
