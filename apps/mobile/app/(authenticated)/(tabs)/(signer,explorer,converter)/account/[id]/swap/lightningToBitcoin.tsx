import 'react-native-get-random-values'

import * as ecc from '@bitcoinerlab/secp256k1'
import { sha256 } from '@noble/hashes/sha256'
import * as bitcoin from 'bitcoinjs-lib'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import boltzApi from '@/api/boltz'
import Esplora from '@/api/esplora'
import SSAmountInput from '@/components/SSAmountInput'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import { useEcash } from '@/hooks/useEcash'
import { useLND } from '@/hooks/useLND'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useEcashStore } from '@/store/ecash'
import { useLightningStore } from '@/store/lightning'
import { usePriceStore } from '@/store/price'
import { useSwapStore } from '@/store/swap'
import { Colors } from '@/styles'
import { type Swap } from '@/types/models/Swap'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatNumber } from '@/utils/format'

bitcoin.initEccLib(ecc)

type Step = 'selectSource' | 'enterAmount' | 'status'
type SourceType = 'lightning' | 'ecash'
type Source = { type: SourceType; id: string; label: string }

// ── Taproot claim helpers ────────────────────────────────────────────────────

function encodeVarInt(n: number): Buffer {
  if (n < 0xfd) return Buffer.from([n])
  const buf = Buffer.alloc(3)
  buf.writeUInt8(0xfd)
  buf.writeUInt16LE(n, 1)
  return buf
}

function tapLeafHash(version: number, script: Buffer): Buffer {
  const data = Buffer.concat([
    Buffer.from([version]),
    encodeVarInt(script.length),
    script
  ])
  return bitcoin.crypto.taggedHash('TapLeaf', data)
}

function tapBranchHash(a: Buffer, b: Buffer): Buffer {
  const [l, r] = a.compare(b) <= 0 ? [a, b] : [b, a]
  return bitcoin.crypto.taggedHash('TapBranch', Buffer.concat([l, r]))
}

/** BIP327 MuSig2 key aggregation for [serverKey, claimKey] as used by Boltz */
function musig2AggXOnly(serverKeyHex: string, claimKeyHex: string): Buffer {
  // Strip compressed prefix if present
  const serverX = Buffer.from(
    serverKeyHex.length === 66 ? serverKeyHex.slice(2) : serverKeyHex,
    'hex'
  )
  const claimX = Buffer.from(
    claimKeyHex.length === 66 ? claimKeyHex.slice(2) : claimKeyHex,
    'hex'
  )

  // L = tagged_hash('KeyAgg list', serverX || claimX) — in the order Boltz uses
  const L = bitcoin.crypto.taggedHash(
    'KeyAgg list',
    Buffer.concat([serverX, claimX])
  )

  // GetSecondKey([serverKey, claimKey]) = claimKey (second distinct key)
  // → claimKey coefficient = 1
  // → serverKey coefficient = tagged_hash('KeyAgg coefficient', L || serverX) mod n
  const n = BigInt(
    '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141'
  )
  const aHashBuf = bitcoin.crypto.taggedHash(
    'KeyAgg coefficient',
    Buffer.concat([L, serverX])
  )
  const aMod = BigInt('0x' + aHashBuf.toString('hex')) % n
  const aBuf = Buffer.from(aMod.toString(16).padStart(64, '0'), 'hex')

  // a_server * lift_x(serverX) — lift_x assumes even y (prefix 0x02)
  const serverPoint = ecc.pointMultiply(
    Buffer.concat([Buffer.from([0x02]), serverX]),
    aBuf,
    true
  )
  if (!serverPoint) throw new Error('musig2: server point multiply failed')

  // Q = serverPoint + lift_x(claimX)
  const claimPoint = Buffer.concat([Buffer.from([0x02]), claimX])
  const Q = ecc.pointAdd(Buffer.from(serverPoint), claimPoint, true)
  if (!Q) throw new Error('musig2: point add failed')

  // x-only (remove compressed prefix byte)
  return Buffer.from(Q).slice(1)
}

async function broadcastClaimTx(
  swap: Swap,
  claimAddress: string,
  network: bitcoin.networks.Network,
  esploraUrl: string
): Promise<string> {
  if (
    !swap.preimage ||
    !swap.claimPrivKey ||
    !swap.swapTree ||
    !swap.refundPublicKey ||
    !swap.lockupAddress
  ) {
    throw new Error('Missing claim data')
  }

  const preimage = Buffer.from(swap.preimage, 'hex')
  const privKey = Buffer.from(swap.claimPrivKey, 'hex')

  const claimLeaf = swap.swapTree.claimLeaf
  const refundLeaf = swap.swapTree.refundLeaf
  const claimScript = Buffer.from(claimLeaf.output, 'hex')
  const refundScript = Buffer.from(refundLeaf.output, 'hex')

  // Leaf hashes
  const claimHash = tapLeafHash(claimLeaf.version, claimScript)
  const refundHash = tapLeafHash(refundLeaf.version, refundScript)

  // Merkle root
  const merkleRoot = tapBranchHash(claimHash, refundHash)

  // MuSig2 aggregate internal key
  const pubKeyBytes = ecc.pointFromScalar(privKey, true)
  if (!pubKeyBytes) throw new Error('Failed to derive public key')
  const claimPubKeyX = Buffer.from(pubKeyBytes).slice(1).toString('hex')
  const internalKey = musig2AggXOnly(swap.refundPublicKey, claimPubKeyX)

  // Compute taptweak + parity via xOnlyPointAddTweak
  const tapTweak = bitcoin.crypto.taggedHash(
    'TapTweak',
    Buffer.concat([internalKey, merkleRoot])
  )
  const tweakResult = ecc.xOnlyPointAddTweak(internalKey, tapTweak)
  if (!tweakResult) throw new Error('Failed to compute tweaked key')
  const parityBit = tweakResult.parity

  // Control block for claim leaf: [version|parity, internalKey, refundLeafHash]
  const controlBlock = Buffer.concat([
    Buffer.from([claimLeaf.version | parityBit]),
    internalKey,
    refundHash
  ])

  // Get UTXOs at lockup address
  const esplora = new Esplora(esploraUrl)
  const utxos = await esplora.getAddressUtxos(swap.lockupAddress)
  if (!utxos.length) throw new Error('No UTXOs at lockup address')
  const utxo = utxos[0]

  const lockupOutputScript = bitcoin.address.toOutputScript(
    swap.lockupAddress,
    network
  )

  // Build transaction
  const tx = new bitcoin.Transaction()
  tx.version = 2
  tx.addInput(Buffer.from(utxo.txid, 'hex').reverse(), utxo.vout, 0xffffffff)
  tx.addOutput(
    bitcoin.address.toOutputScript(claimAddress, network),
    utxo.value - 2000 // subtract estimated fee
  )

  // Sighash for tapscript path
  const leafHash = tapLeafHash(claimLeaf.version, claimScript)
  const sigHash = tx.hashForWitnessV1(
    0,
    [lockupOutputScript],
    [utxo.value],
    bitcoin.Transaction.SIGHASH_DEFAULT,
    leafHash
  )

  // Sign with claim key
  const auxRand = new Uint8Array(32)
  crypto.getRandomValues(auxRand)
  const sig = ecc.signSchnorr(sigHash, privKey, auxRand)

  // Witness: [sig, preimage, claimScript, controlBlock]
  tx.setWitness(0, [Buffer.from(sig), preimage, claimScript, controlBlock])

  return esplora.broadcastTransaction(tx.toHex())
}

// ── Component ────────────────────────────────────────────────────────────────

export default function LightningToBitcoinSwapPage() {
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const account = useAccountsStore((state) =>
    state.accounts.find((a) => a.id === id)
  )
  const mints = useEcashStore((state) => state.mints)
  const lndConfig = useLightningStore((state) => state.config)
  const mempoolUrl = useBlockchainStore(
    (state) => state.configsMempool['bitcoin']
  )
  const [addSwap, updateSwapStatus, boltzUrl] = useSwapStore(
    useShallow((state) => [state.addSwap, state.updateSwapStatus, state.boltzUrl])
  )
  const [fiatCurrency, satsToFiat, btcPrice] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat, state.btcPrice])
  )
  const { meltProofs, createMeltQuote } = useEcash()
  const { payInvoice } = useLND()

  const [step, setStep] = useState<Step>('selectSource')
  const [selectedSource, setSelectedSource] = useState<Source | null>(null)
  const [amount, setAmount] = useState(0)
  const [resetKey, setResetKey] = useState(0)
  const [feeInfo, setFeeInfo] = useState<string | null>(null)
  const [minAmount, setMinAmount] = useState<number | null>(null)
  const [maxAmount, setMaxAmount] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [swapRecord, setSwapRecord] = useState<Swap | null>(null)
  const [swapStatus, setSwapStatus] = useState<string>('pending')
  const [claimTxid, setClaimTxid] = useState<string | null>(null)

  const unsubscribeRef = useRef<(() => void) | null>(null)

  const sources: Source[] = [
    ...(lndConfig
      ? [
          {
            type: 'lightning' as SourceType,
            id: 'lnd',
            label: 'Lightning Node'
          }
        ]
      : []),
    ...mints.map((m) => ({
      type: 'ecash' as SourceType,
      id: m.url,
      label: m.name || m.url
    }))
  ]

  // First external address of the account as claim destination
  const claimAddress = account?.addresses?.find(
    (a) => a.keychain === 'external'
  )?.address

  useEffect(() => {
    boltzApi.baseUrl = boltzUrl
    boltzApi
      .getReversePairs()
      .then((pairs) => {
        const info = pairs.BTC?.BTC
        if (info) {
          const claimFee = info.fees.minerFees.reverse.claim
          const pct = info.fees.percentage
          setFeeInfo(`${pct}% + ${claimFee} sats claim fee`)
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

  const handleConfirmAmount = useCallback(async () => {
    if (!selectedSource || amount <= 0 || !id || !account) return
    const amountSats = amount
    if (!claimAddress) {
      toast.error('No receive address found for this account')
      return
    }

    setIsLoading(true)
    try {
      // 1. Generate preimage + preimage hash
      const preimageBytes = new Uint8Array(32)
      crypto.getRandomValues(preimageBytes)
      const preimageHash = sha256(preimageBytes)
      const preimageHex = Buffer.from(preimageBytes).toString('hex')
      const preimageHashHex = Buffer.from(preimageHash).toString('hex')

      // 2. Generate claim key pair
      const privKeyBytes = new Uint8Array(32)
      crypto.getRandomValues(privKeyBytes)
      const pubKeyBytes = ecc.pointFromScalar(Buffer.from(privKeyBytes), true)
      if (!pubKeyBytes) throw new Error('Failed to generate key pair')
      const claimPubKeyHex = Buffer.from(pubKeyBytes).toString('hex')
      const claimPrivKeyHex = Buffer.from(privKeyBytes).toString('hex')

      // 3. Create reverse swap
      const swap = await boltzApi.createReverseSwap({
        invoiceAmount: amountSats,
        from: 'BTC',
        to: 'BTC',
        claimPublicKey: claimPubKeyHex,
        preimageHash: preimageHashHex
      })

      // 4. Save to store
      const record: Swap = {
        id: swap.id,
        direction: 'lightning-to-btc',
        status: 'pending',
        amountSats,
        createdAt: new Date().toISOString(),
        sourceAccountId: selectedSource.id,
        destinationAccountId: id,
        invoice: swap.invoice,
        preimage: preimageHex,
        claimPrivKey: claimPrivKeyHex,
        claimPublicKey: claimPubKeyHex,
        swapTree: swap.swapTree,
        refundPublicKey: swap.refundPublicKey,
        lockupAddress: swap.lockupAddress
      }
      addSwap(record)
      setSwapRecord(record)

      // 5. Pay the invoice
      if (selectedSource.type === 'lightning') {
        await payInvoice(swap.invoice)
      } else {
        const meltQuote = await createMeltQuote(selectedSource.id, swap.invoice)
        const ecashStore = await import('@/store/ecash')
        const proofs = ecashStore.useEcashStore.getState().proofs
        await meltProofs(
          selectedSource.id,
          meltQuote,
          proofs,
          'Boltz swap',
          swap.invoice
        )
      }

      // 6. Subscribe to WebSocket for status
      const unsub = boltzApi.subscribeToSwap(swap.id, async (status) => {
        setSwapStatus(status)
        updateSwapStatus(swap.id, status as Swap['status'])

        if (status === 'transaction.mempool') {
          // Claim the on-chain UTXO
          try {
            const esploraUrl = mempoolUrl
              ? `${mempoolUrl}/api`
              : 'https://mempool.space/api'
            const network =
              account.network === 'bitcoin'
                ? bitcoin.networks.bitcoin
                : bitcoin.networks.testnet
            const txid = await broadcastClaimTx(
              record,
              claimAddress,
              network,
              esploraUrl
            )
            setClaimTxid(txid)
            updateSwapStatus(swap.id, 'transaction.claimed', { txid })
          } catch (claimErr) {
            toast.error(
              claimErr instanceof Error
                ? claimErr.message
                : 'Failed to broadcast claim transaction'
            )
          }
        }
      })
      unsubscribeRef.current = unsub

      setStep('status')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create swap')
    } finally {
      setIsLoading(false)
    }
  }, [
    selectedSource,
    amount,
    id,
    account,
    claimAddress,
    mempoolUrl,
    addSwap,
    updateSwapStatus,
    payInvoice,
    createMeltQuote,
    meltProofs
  ])

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
          headerTitle: () => <SSText uppercase>Lightning → Bitcoin</SSText>
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack gap="lg" style={styles.content}>
          {/* Destination (read-only) */}
          <SSVStack gap="xs">
            <SSText color="muted" size="xs" uppercase>
              Destination
            </SSText>
            <View style={styles.infoBox}>
              <SSText weight="medium">{account?.name ?? id}</SSText>
              {claimAddress && (
                <SSText color="muted" size="xs" style={styles.monoText}>
                  {claimAddress}
                </SSText>
              )}
            </View>
          </SSVStack>

          {step === 'selectSource' && (
            <>
              <SSVStack gap="xs">
                <SSText color="muted" size="xs" uppercase>
                  Select Lightning source
                </SSText>
                {sources.length === 0 && (
                  <SSText color="muted" size="sm">
                    No Lightning node or Ecash mint configured
                  </SSText>
                )}
                {sources.map((src) => (
                  <SSButton
                    key={src.id}
                    label={src.label}
                    variant={
                      selectedSource?.id === src.id ? 'outline' : 'subtle'
                    }
                    onPress={() => setSelectedSource(src)}
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
                disabled={!selectedSource}
                onPress={() => setStep('enterAmount')}
              />
            </>
          )}

          {step === 'enterAmount' && (
            <>
              <SSVStack gap="xs">
                <SSText color="muted" size="xs" uppercase>
                  Source
                </SSText>
                <View style={styles.infoBox}>
                  <SSText>{selectedSource?.label}</SSText>
                </View>
              </SSVStack>
              <SSAmountInput
                key={resetKey}
                min={minAmount ?? 1}
                max={Math.max(minAmount ?? 1, maxAmount ?? 10000000)}
                value={amount}
                remainingSats={maxAmount ?? 10000000}
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
              {amount > 0 && maxAmount !== null && amount > maxAmount && (
                <SSText style={styles.warning}>
                  Amount exceeds Boltz maximum ({maxAmount.toLocaleString()}{' '}
                  sats)
                </SSText>
              )}
              <SSHStack gap="sm">
                <SSButton
                  label="Back"
                  variant="subtle"
                  style={{ flex: 1 }}
                  onPress={() => setStep('selectSource')}
                />
                <SSButton
                  label="Create Swap"
                  variant="gradient"
                  gradientType="special"
                  style={{ flex: 1 }}
                  loading={isLoading}
                  disabled={
                    amount <= 0 ||
                    isLoading ||
                    !claimAddress ||
                    (maxAmount !== null && amount > maxAmount)
                  }
                  onPress={handleConfirmAmount}
                />
              </SSHStack>
            </>
          )}

          {step === 'status' && swapRecord && (
            <>
              <SSVStack gap="xs">
                <SSText color="muted" size="xs" uppercase>
                  Status
                </SSText>
                <SSText style={{ color: getStatusColor(swapStatus) }}>
                  {swapStatus}
                </SSText>
              </SSVStack>
              {swapRecord.invoice && (
                <SSVStack gap="xs">
                  <SSText color="muted" size="xs" uppercase>
                    Invoice (paid)
                  </SSText>
                  <View style={styles.infoBox}>
                    <SSText size="xs" style={styles.monoText} numberOfLines={2}>
                      {swapRecord.invoice}
                    </SSText>
                  </View>
                </SSVStack>
              )}
              {claimTxid && (
                <SSVStack gap="xs">
                  <SSText color="muted" size="xs" uppercase>
                    Claim TX
                  </SSText>
                  <View style={styles.infoBox}>
                    <SSText size="xs" style={styles.monoText}>
                      {claimTxid}
                    </SSText>
                  </View>
                </SSVStack>
              )}
              <SSText color="muted" size="xs">
                Swap ID: {swapRecord.id}
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
  },
  warning: {
    color: Colors.error ?? '#ef4444',
    fontSize: 12
  }
})
