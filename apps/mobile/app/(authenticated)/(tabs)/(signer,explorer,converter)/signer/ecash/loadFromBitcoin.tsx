import 'react-native-get-random-values'

import * as ecc from '@bitcoinerlab/secp256k1'
import * as bitcoin from 'bitcoinjs-lib'
import { Stack, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import boltzApi from '@/api/boltz'
import SSAmountInput from '@/components/SSAmountInput'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSUtxoItem from '@/components/SSUtxoItem'
import { useEcash } from '@/hooks/useEcash'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { useAccountsStore } from '@/store/accounts'
import { useEcashStore } from '@/store/ecash'
import { usePriceStore } from '@/store/price'
import { useSwapStore } from '@/store/swap'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors } from '@/styles'
import { type Swap } from '@/types/models/Swap'
import { type Utxo } from '@/types/models/Utxo'
import { formatNumber } from '@/utils/format'
import { getUtxoOutpoint } from '@/utils/utxo'

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
  const [addSwap, updateSwapStatus, boltzUrl] = useSwapStore(
    useShallow((state) => [state.addSwap, state.updateSwapStatus, state.boltzUrl])
  )
  const [clearTransaction, setAccountId, addInput, addOutput] =
    useTransactionBuilderStore(
      useShallow((state) => [
        state.clearTransaction,
        state.setAccountId,
        state.addInput,
        state.addOutput
      ])
    )
  const [fiatCurrency, satsToFiat, btcPrice] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat, state.btcPrice])
  )
  const { createMintQuote } = useEcash()

  const [step, setStep] = useState<Step>('selectAccount')
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null
  )
  const [amount, setAmount] = useState(0)
  const [resetKey, setResetKey] = useState(0)
  const [feeInfo, setFeeInfo] = useState<string | null>(null)
  const [minAmount, setMinAmount] = useState<number | null>(null)
  const [maxAmount, setMaxAmount] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [swapId, setSwapId] = useState<string | null>(null)
  const [swapStatus, setSwapStatus] = useState<string>('pending')
  const [lockupAddress, setLockupAddress] = useState<string | null>(null)
  const [expectedAmount, setExpectedAmount] = useState<number | null>(null)
  const [selectedUtxos, setSelectedUtxos] = useState<Map<string, Utxo>>(
    new Map()
  )
  const [showUtxoSelector, setShowUtxoSelector] = useState(false)

  const unsubscribeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    boltzApi.baseUrl = boltzUrl
    boltzApi
      .getSubmarinePairs()
      .then((pairs) => {
        const info = pairs.BTC?.BTC
        if (info) {
          const minerFee = info.fees.minerFees.normal
          const pct = info.fees.percentage
          setFeeInfo(`${pct}% + ${minerFee} sats miner fee`)
          setMinAmount(info.limits.minimal)
          setMaxAmount(info.limits.maximal)
        }
      })
      .catch(() => {
        // ignore
      })
  }, [boltzUrl])

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.()
    }
  }, [])

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId)

  const handleConfirmAmount = useCallback(async () => {
    if (!selectedAccountId || amount <= 0 || !activeMint) return
    const amountSats = amount

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
    setAccountId(selectedAccountId)
    addOutput({
      to: lockupAddress,
      amount: expectedAmount,
      label: 'Boltz swap'
    })
    for (const utxo of selectedUtxos.values()) {
      addInput(utxo)
    }
    router.navigate(`/account/${selectedAccountId}/signAndSend/selectUtxoList`)
  }, [
    lockupAddress,
    expectedAmount,
    selectedAccountId,
    clearTransaction,
    setAccountId,
    addOutput,
    addInput,
    selectedUtxos,
    router
  ])

  const selectedAccountUtxos = selectedAccount?.utxos ?? []
  const selectedAccountBalance = selectedAccount?.summary?.balance ?? 0
  const selectedUtxosTotal = Array.from(selectedUtxos.values()).reduce(
    (sum, u) => sum + u.value,
    0
  )
  const availableMax = (() => {
    const base =
      selectedUtxos.size > 0 ? selectedUtxosTotal : selectedAccountBalance
    return maxAmount != null ? Math.min(base, maxAmount) : base
  })()

  function toggleUtxo(utxo: Utxo) {
    const key = getUtxoOutpoint(utxo)
    const next = new Map(selectedUtxos)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.set(key, utxo)
    }
    setSelectedUtxos(next)
    // Clamp amount if the new selection lowers the available max
    const newTotal = Array.from(next.values()).reduce(
      (sum, u) => sum + u.value,
      0
    )
    const newBase = next.size > 0 ? newTotal : selectedAccountBalance
    const newMax = maxAmount != null ? Math.min(newBase, maxAmount) : newBase
    if (amount > newMax) {
      setAmount(newMax)
      setResetKey((k) => k + 1)
    }
  }

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
              <SSAmountInput
                key={resetKey}
                min={minAmount ?? 1}
                max={Math.max(minAmount ?? 1, availableMax)}
                value={amount}
                remainingSats={availableMax}
                fiatCurrency={fiatCurrency}
                btcPrice={btcPrice}
                satsToFiat={satsToFiat}
                onValueChange={setAmount}
              />
              {minAmount !== null && (
                <SSButton
                  label={`Min: ${minAmount.toLocaleString()} sats (${formatNumber(satsToFiat(minAmount), 2)} ${fiatCurrency})`}
                  variant="subtle"
                  onPress={() => {
                    setAmount(minAmount)
                    setResetKey((k) => k + 1)
                  }}
                />
              )}
              {feeInfo && (
                <SSText color="muted" size="xs">
                  Fees: {feeInfo}
                </SSText>
              )}
              {/* UTXO selector */}
              <SSButton
                label={
                  showUtxoSelector
                    ? `Hide UTXOs${selectedUtxos.size > 0 ? ` (${selectedUtxos.size} selected)` : ''}`
                    : `Select UTXOs${selectedUtxos.size > 0 ? ` (${selectedUtxos.size} selected)` : ' (optional)'}`
                }
                variant="subtle"
                onPress={() => setShowUtxoSelector((v) => !v)}
              />
              {showUtxoSelector && selectedAccountUtxos.length > 0 && (
                <SSVStack gap="none" style={styles.utxoList}>
                  {selectedAccountUtxos.map((utxo) => (
                    <SSUtxoItem
                      key={getUtxoOutpoint(utxo)}
                      utxo={utxo}
                      selected={selectedUtxos.has(getUtxoOutpoint(utxo))}
                      largestValue={Math.max(
                        ...selectedAccountUtxos.map((u) => u.value)
                      )}
                      onToggleSelected={toggleUtxo}
                    />
                  ))}
                </SSVStack>
              )}
              {showUtxoSelector && selectedAccountUtxos.length === 0 && (
                <SSText color="muted" size="sm">
                  No UTXOs in this account
                </SSText>
              )}
              {amount > 0 && amount > availableMax && (
                <SSText style={styles.warning}>
                  {selectedUtxos.size > 0
                    ? `Selected UTXOs total ${selectedUtxosTotal.toLocaleString()} sats — not enough to cover this amount`
                    : `Insufficient balance (${selectedAccountBalance.toLocaleString()} sats available)`}
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
                  disabled={amount <= 0 || amount > availableMax || isLoading}
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
  },
  utxoList: {
    borderWidth: 1,
    borderColor: Colors.gray[800],
    borderRadius: 4
  },
  warning: {
    color: Colors.error ?? '#ef4444',
    fontSize: 12
  }
})
