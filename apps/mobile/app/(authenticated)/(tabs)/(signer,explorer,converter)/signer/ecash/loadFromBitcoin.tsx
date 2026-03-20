import 'react-native-get-random-values'

import * as ecc from '@bitcoinerlab/secp256k1'
import * as bitcoin from 'bitcoinjs-lib'
import { Stack, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import boltzApi from '@/api/boltz'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useEcash } from '@/hooks/useEcash'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { useAccountsStore } from '@/store/accounts'
import { useEcashStore } from '@/store/ecash'
import { useSwapStore } from '@/store/swap'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors } from '@/styles'
import { type Swap } from '@/types/models/Swap'

bitcoin.initEccLib(ecc)

type Step = 'selectAccount' | 'enterAmount' | 'status'

export default function EcashLoadFromBitcoinPage() {
  const router = useRouter()

  const accounts = useAccountsStore((state) =>
    state.accounts.filter(
      (a) => a.policyType !== 'watchonly' && a.summary?.balance !== undefined
    )
  )
  const activeMint = useEcashStore((state) => state.activeMint)
  const [addSwap, updateSwapStatus] = useSwapStore(
    useShallow((state) => [state.addSwap, state.updateSwapStatus])
  )
  const [clearTransaction, addOutput] = useTransactionBuilderStore(
    useShallow((state) => [state.clearTransaction, state.addOutput])
  )
  const { createMintQuote } = useEcash()

  const [step, setStep] = useState<Step>('selectAccount')
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null
  )
  const [amount, setAmount] = useState('')
  const [feeInfo, setFeeInfo] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [swapId, setSwapId] = useState<string | null>(null)
  const [swapStatus, setSwapStatus] = useState<string>('pending')
  const [lockupAddress, setLockupAddress] = useState<string | null>(null)
  const [expectedAmount, setExpectedAmount] = useState<number | null>(null)

  const unsubscribeRef = useRef<(() => void) | null>(null)

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
        // ignore
      })
  }, [])

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.()
    }
  }, [])

  const handleConfirmAmount = useCallback(async () => {
    if (!selectedAccountId || !amount || !activeMint) return
    const amountSats = parseInt(amount, 10)
    if (isNaN(amountSats) || amountSats <= 0) {
      toast.error('Invalid amount')
      return
    }

    setIsLoading(true)
    try {
      // 1. Create mint quote (Lightning invoice) from active Ecash mint
      const quote = await createMintQuote(activeMint.url, amountSats)
      const invoice = quote.request

      // 2. Generate refund key pair
      const privKey = new Uint8Array(32)
      crypto.getRandomValues(privKey)
      const pubKeyBytes = ecc.pointFromScalar(Buffer.from(privKey), true)
      if (!pubKeyBytes) throw new Error('Failed to generate key pair')
      const refundPublicKey = Buffer.from(pubKeyBytes).toString('hex')

      // 3. Create submarine swap
      const swap = await boltzApi.createSubmarineSwap({
        invoice,
        from: 'BTC',
        to: 'BTC',
        refundPublicKey
      })

      // 4. Save swap
      const record: Swap = {
        id: swap.id,
        direction: 'btc-to-lightning',
        status: 'pending',
        amountSats,
        createdAt: new Date().toISOString(),
        sourceAccountId: selectedAccountId,
        destinationAccountId: activeMint.url,
        address: swap.address,
        expectedAmount: swap.expectedAmount
      }
      addSwap(record)
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
    selectedAccountId,
    amount,
    activeMint,
    createMintQuote,
    addSwap,
    updateSwapStatus
  ])

  const handleSendToLockup = useCallback(() => {
    if (!lockupAddress || !expectedAmount || !selectedAccountId) return
    clearTransaction()
    addOutput({
      to: lockupAddress,
      amount: expectedAmount,
      label: 'Boltz swap'
    })
    router.navigate(`/account/${selectedAccountId}/signAndSend/selectUtxoList`)
  }, [
    lockupAddress,
    expectedAmount,
    selectedAccountId,
    clearTransaction,
    addOutput,
    router
  ])

  function getStatusColor(status: string) {
    if (status === 'transaction.claimed') return Colors.success ?? '#22c55e'
    if (status === 'error' || status === 'expired')
      return Colors.error ?? '#ef4444'
    return Colors.gray[200]
  }

  if (!activeMint) {
    return (
      <SSMainLayout>
        <Stack.Screen
          options={{
            headerTitle: () => <SSText uppercase>Load from Bitcoin</SSText>
          }}
        />
        <SSVStack itemsCenter gap="lg" style={{ paddingTop: 60 }}>
          <SSText>No Ecash mint connected</SSText>
          <SSButton
            label="Connect a Mint"
            variant="gradient"
            gradientType="special"
            onPress={() => router.navigate('/signer/ecash/settings/mint')}
          />
        </SSVStack>
      </SSMainLayout>
    )
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>Load from Bitcoin</SSText>
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack gap="lg" style={styles.content}>
          {/* Destination (read-only) */}
          <SSVStack gap="xs">
            <SSText color="muted" size="xs" uppercase>
              Destination mint
            </SSText>
            <View style={styles.infoBox}>
              <SSText weight="medium">
                {activeMint.name || activeMint.url}
              </SSText>
            </View>
          </SSVStack>

          {step === 'selectAccount' && (
            <>
              <SSVStack gap="xs">
                <SSText color="muted" size="xs" uppercase>
                  Select Bitcoin source account
                </SSText>
                {accounts.length === 0 && (
                  <SSText color="muted" size="sm">
                    No Bitcoin accounts available
                  </SSText>
                )}
                {accounts.map((acc) => (
                  <SSButton
                    key={acc.id}
                    label={`${acc.name} — ${(acc.summary?.balance ?? 0).toLocaleString()} sats`}
                    variant={
                      selectedAccountId === acc.id ? 'outline' : 'subtle'
                    }
                    onPress={() => setSelectedAccountId(acc.id)}
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
                disabled={!selectedAccountId}
                onPress={() => setStep('enterAmount')}
              />
            </>
          )}

          {step === 'enterAmount' && (
            <>
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
                  onPress={() => setStep('selectAccount')}
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
                  Ecash received — swap complete
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
