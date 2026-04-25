import * as Clipboard from 'expo-clipboard'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSPairedTabs from '@/components/SSPairedTabs'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import {
  useArkAddress,
  useArkBolt11InvoiceMutation
} from '@/hooks/useArkReceive'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { formatNumber } from '@/utils/format'

type ReceiveTab = 'ark' | 'lightning'

async function copyToClipboard(value: string) {
  try {
    await Clipboard.setStringAsync(value)
    toast.success(t('common.copiedToClipboard'))
  } catch {
    toast.error(t('ecash.error.failedToCopy'))
  }
}

export default function ArkReceivePage() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<ReceiveTab>('ark')
  const [amount, setAmount] = useState('')

  const addressQuery = useArkAddress(id)
  const invoiceMutation = useArkBolt11InvoiceMutation(id)

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

  function handleCreateInvoice() {
    if (amountSats <= 0) {
      toast.error(t('ark.error.invalidAmount'))
      return
    }
    invoiceMutation.mutate(amountSats, {
      onError: (error) => {
        const message =
          error instanceof Error
            ? error.message
            : t('ark.error.invoiceGeneration')
        toast.error(message)
      }
    })
  }

  function handleResetInvoice() {
    invoiceMutation.reset()
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
                    <SSTextInput
                      value={amount ? formatNumber(parseInt(amount, 10)) : ''}
                      onChangeText={(text) =>
                        setAmount(text.replace(/[^0-9]/g, ''))
                      }
                      placeholder="0"
                      keyboardType="numeric"
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
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 20
  }
})
