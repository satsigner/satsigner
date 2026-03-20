import 'react-native-get-random-values'

import * as ecc from '@bitcoinerlab/secp256k1'
import * as bitcoin from 'bitcoinjs-lib'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import boltzApi from '@/api/boltz'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useEcash } from '@/hooks/useEcash'
import { useLND } from '@/hooks/useLND'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { useAccountsStore } from '@/store/accounts'
import { useEcashStore } from '@/store/ecash'
import { useLightningStore } from '@/store/lightning'
import { useSwapStore } from '@/store/swap'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors } from '@/styles'
import { type Swap } from '@/types/models/Swap'
import { type AccountSearchParams } from '@/types/navigation/searchParams'

bitcoin.initEccLib(ecc)

type Step = 'selectDestination' | 'enterAmount' | 'status'
type DestinationType = 'lightning' | 'ecash'
type Destination = {
  type: DestinationType
  id: string
  label: string
}

export default function BitcoinToLightningSwapPage() {
  const { id } = useLocalSearchParams<AccountSearchParams>()
  const router = useRouter()

  const account = useAccountsStore((state) =>
    state.accounts.find((a) => a.id === id)
  )
  const mints = useEcashStore((state) => state.mints)
  const lndConfig = useLightningStore((state) => state.config)
  const [addSwap, updateSwapStatus] = useSwapStore(
    useShallow((state) => [state.addSwap, state.updateSwapStatus])
  )
  const [clearTransaction, addOutput] = useTransactionBuilderStore(
    useShallow((state) => [state.clearTransaction, state.addOutput])
  )
  const { createMintQuote } = useEcash()
  const { createInvoice } = useLND()

  const [step, setStep] = useState<Step>('selectDestination')
  const [selectedDest, setSelectedDest] = useState<Destination | null>(null)
  const [amount, setAmount] = useState('')
  const [feeInfo, setFeeInfo] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [swapId, setSwapId] = useState<string | null>(null)
  const [swapStatus, setSwapStatus] = useState<string>('pending')
  const [lockupAddress, setLockupAddress] = useState<string | null>(null)
  const [expectedAmount, setExpectedAmount] = useState<number | null>(null)

  const unsubscribeRef = useRef<(() => void) | null>(null)

  const destinations: Destination[] = [
    ...(lndConfig
      ? [
          {
            type: 'lightning' as DestinationType,
            id: 'lnd',
            label: 'Lightning Node'
          }
        ]
      : []),
    ...mints.map((m) => ({
      type: 'ecash' as DestinationType,
      id: m.url,
      label: m.name || m.url
    }))
  ]

  useEffect(() => {
    boltzApi
      .getSubmarinePairs()
      .then((pairs) => {
        const info = pairs.BTC?.BTC
        if (info) {
          const minerFee = info.fees.minerFees.normal
          const pct = info.fees.percentage
          setFeeInfo(`${pct}% + ${minerFee} sats miner fee`)
        }
      })
      .catch(() => {
        // ignore fee fetch errors
      })
  }, [])

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.()
    }
  }, [])

  const handleConfirmAmount = useCallback(async () => {
    if (!selectedDest || !amount || !id || !account) return
    const amountSats = parseInt(amount, 10)
    if (isNaN(amountSats) || amountSats <= 0) {
      toast.error('Invalid amount')
      return
    }

    setIsLoading(true)
    try {
      // 1. Create Lightning invoice from selected destination
      let invoice = ''
      if (selectedDest.type === 'lightning') {
        const result = (await createInvoice(amountSats, 'Boltz swap')) as {
          payment_request: string
        }
        invoice = result.payment_request
      } else {
        // Ecash mint quote
        const quote = await createMintQuote(selectedDest.id, amountSats)
        invoice = quote.request
      }

      // 2. Generate refund key pair
      const privKey = new Uint8Array(32)
      crypto.getRandomValues(privKey)
      const pubKeyBytes = ecc.pointFromScalar(privKey, true)
      if (!pubKeyBytes) throw new Error('Failed to generate key pair')
      const refundPublicKey = Buffer.from(pubKeyBytes).toString('hex')

      // 3. Create submarine swap
      const swap = await boltzApi.createSubmarineSwap({
        invoice,
        from: 'BTC',
        to: 'BTC',
        refundPublicKey
      })

      // 4. Save to store
      const swapRecord: Swap = {
        id: swap.id,
        direction: 'btc-to-lightning',
        status: 'pending',
        amountSats,
        createdAt: new Date().toISOString(),
        sourceAccountId: id,
        destinationAccountId: selectedDest.id,
        address: swap.address,
        expectedAmount: swap.expectedAmount
      }
      addSwap(swapRecord)
      setSwapId(swap.id)
      setLockupAddress(swap.address)
      setExpectedAmount(swap.expectedAmount)

      // 5. Subscribe to status updates
      unsubscribeRef.current = boltzApi.subscribeToSwap(swap.id, (status) => {
        setSwapStatus(status)
        updateSwapStatus(swap.id, status as Swap['status'])
      })

      setStep('status')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create swap')
    } finally {
      setIsLoading(false)
    }
  }, [
    selectedDest,
    amount,
    id,
    account,
    createInvoice,
    createMintQuote,
    addSwap,
    updateSwapStatus
  ])

  const handleSendToLockup = useCallback(() => {
    if (!lockupAddress || !expectedAmount || !id) return
    clearTransaction()
    addOutput({
      to: lockupAddress,
      amount: expectedAmount,
      label: 'Boltz swap'
    })
    router.navigate(`/account/${id}/signAndSend/selectUtxoList`)
  }, [lockupAddress, expectedAmount, id, clearTransaction, addOutput, router])

  function getStatusColor(status: string) {
    if (status === 'transaction.claimed') return Colors.success ?? '#22c55e'
    if (status === 'error' || status === 'expired')
      return Colors.error ?? '#ef4444'
    return Colors.gray[200]
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>Bitcoin → Lightning</SSText>
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack gap="lg" style={styles.content}>
          {/* Source (read-only) */}
          <SSVStack gap="xs">
            <SSText color="muted" size="xs" uppercase>
              Source
            </SSText>
            <View style={styles.infoBox}>
              <SSText weight="medium">{account?.name ?? id}</SSText>
              {account?.summary?.balance !== undefined && (
                <SSText color="muted" size="sm">
                  {account.summary.balance.toLocaleString()} sats
                </SSText>
              )}
            </View>
          </SSVStack>

          {step === 'selectDestination' && (
            <>
              <SSVStack gap="xs">
                <SSText color="muted" size="xs" uppercase>
                  Select destination
                </SSText>
                {destinations.length === 0 && (
                  <SSText color="muted" size="sm">
                    No Lightning node or Ecash mint configured
                  </SSText>
                )}
                {destinations.map((dest) => (
                  <SSButton
                    key={dest.id}
                    label={dest.label}
                    variant={
                      selectedDest?.id === dest.id ? 'outline' : 'subtle'
                    }
                    onPress={() => setSelectedDest(dest)}
                  />
                ))}
              </SSVStack>
              {feeInfo && (
                <SSText color="muted" size="xs">
                  Fees: {feeInfo}
                </SSText>
              )}
              <SSButton
                label="Next"
                variant="gradient"
                gradientType="special"
                disabled={!selectedDest}
                onPress={() => setStep('enterAmount')}
              />
            </>
          )}

          {step === 'enterAmount' && (
            <>
              <SSVStack gap="xs">
                <SSText color="muted" size="xs" uppercase>
                  Destination
                </SSText>
                <View style={styles.infoBox}>
                  <SSText>{selectedDest?.label}</SSText>
                </View>
              </SSVStack>
              <SSVStack gap="xs">
                <SSText color="muted" size="xs" uppercase>
                  Amount (sats)
                </SSText>
                <SSTextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </SSVStack>
              {feeInfo && (
                <SSText color="muted" size="xs">
                  Fees: {feeInfo}
                </SSText>
              )}
              <SSHStack gap="sm">
                <SSButton
                  label="Back"
                  variant="subtle"
                  style={{ flex: 1 }}
                  onPress={() => setStep('selectDestination')}
                />
                <SSButton
                  label="Create Swap"
                  variant="gradient"
                  gradientType="special"
                  style={{ flex: 1 }}
                  loading={isLoading}
                  disabled={!amount || isLoading}
                  onPress={handleConfirmAmount}
                />
              </SSHStack>
            </>
          )}

          {step === 'status' && swapId && (
            <>
              <SSVStack gap="xs">
                <SSText color="muted" size="xs" uppercase>
                  Status
                </SSText>
                <SSText style={{ color: getStatusColor(swapStatus) }}>
                  {swapStatus}
                </SSText>
              </SSVStack>
              {lockupAddress && (
                <SSVStack gap="xs">
                  <SSText color="muted" size="xs" uppercase>
                    Send {expectedAmount?.toLocaleString()} sats to
                  </SSText>
                  <View style={styles.infoBox}>
                    <SSText size="xs" style={styles.monoText}>
                      {lockupAddress}
                    </SSText>
                  </View>
                  <SSButton
                    label="Open Send Flow"
                    variant="gradient"
                    gradientType="special"
                    onPress={handleSendToLockup}
                    disabled={swapStatus === 'transaction.claimed'}
                  />
                </SSVStack>
              )}
              <SSText color="muted" size="xs">
                Swap ID: {swapId}
              </SSText>
              {swapStatus === 'transaction.claimed' && (
                <SSText style={{ color: Colors.success ?? '#22c55e' }}>
                  Swap completed successfully
                </SSText>
              )}
            </>
          )}
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 60,
    paddingTop: 8
  },
  infoBox: {
    backgroundColor: Colors.gray[925],
    borderWidth: 1,
    borderColor: Colors.gray[800],
    borderRadius: 4,
    padding: 12
  },
  monoText: {
    fontFamily: 'monospace'
  }
})
