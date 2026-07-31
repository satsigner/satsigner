import * as bitcoinjs from 'bitcoinjs-lib'
import * as Clipboard from 'expo-clipboard'
import {
  Redirect,
  useFocusEffect,
  useLocalSearchParams,
  useRouter
} from 'expo-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Psbt, type PsbtLike } from 'react-native-bdk-sdk'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { broadcastTransaction, signTransaction } from '@/api/bdk'
import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import {
  applyManualSenderProposal,
  pollBip77Send,
  sendPayjoin,
  startBip77Send
} from '@/api/payjoin'
import BitcoinRpc from '@/api/rpc'
import { SSIconSuccess } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSLoader from '@/components/SSLoader'
import SSPsbtTransport from '@/components/SSPsbtTransport'
import SSSuccessCheckAnimation from '@/components/SSSuccessCheckAnimation'
import SSText from '@/components/SSText'
import SSTransactionChart from '@/components/SSTransactionChart'
import SSTransactionDecoded from '@/components/SSTransactionDecoded'
import SSTransactionIdFormatted from '@/components/SSTransactionIdFormatted'
import {
  PAYJOIN_DEFAULT_PJOS,
  PAYJOIN_DIRECTORY_URL
} from '@/constants/payjoin'
import useGetAccountWallet from '@/hooks/useGetAccountWallet'
import { useNow } from '@/hooks/useNow'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useNostrStore } from '@/store/nostr'
import { usePayjoinSessionsStore } from '@/store/payjoinSessions'
import { useSettingsStore } from '@/store/settings'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type Output } from '@/types/models/Output'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { type PayjoinSession } from '@/types/payjoin'
import { bitcoinjsNetwork } from '@/utils/bitcoin'
import { formatPayjoinExpiringLabel } from '@/utils/payjoinExpiry'
import {
  compactError,
  mailboxFromUri,
  payjoinLog,
  payjoinWarn
} from '@/utils/payjoinLog'
import { preparePayjoinPsbtForWalletSign } from '@/utils/payjoinSign'
import {
  detectEndpointKind,
  hasPayjoinParam,
  parsePayjoinUri
} from '@/utils/payjoinUri'
import { buildPayjoinWalletCallbacks } from '@/utils/payjoinWallet'
import {
  buildKnownTxIds,
  buildOutpointLabelsByRef,
  buildTxLabelsById
} from '@/utils/sankeyInputLabel'
import {
  estimateTransactionSize,
  legacyEstimateTransactionSize
} from '@/utils/transaction'

const tn = _tn('transaction.build.sign')

function buildSignTransactionChartModel(
  psbt: PsbtLike | null,
  inputs: Map<string, Utxo>,
  outputs: Output[],
  finalizedTxHex: string
): Transaction | null {
  if (!psbt) {
    return null
  }

  const inputArray = Array.from(inputs.values())
  let size: number
  let vsize: number

  const trimmed = finalizedTxHex.trim()
  if (
    trimmed.length >= 20 &&
    /^[0-9a-fA-F]+$/i.test(trimmed) &&
    !trimmed.toLowerCase().startsWith('70736274')
  ) {
    try {
      const finalized = bitcoinjs.Transaction.fromHex(trimmed)
      vsize = finalized.virtualSize()
      size = finalized.byteLength(true)
    } catch {
      const est =
        inputArray.length > 0
          ? estimateTransactionSize(inputArray, outputs)
          : legacyEstimateTransactionSize(inputs.size, outputs.length)
      size = est.size
      vsize = est.vsize
    }
  } else {
    const est =
      inputArray.length > 0
        ? estimateTransactionSize(inputArray, outputs)
        : legacyEstimateTransactionSize(inputs.size, outputs.length)
    size = est.size
    vsize = est.vsize
  }

  const vin = Array.from(inputs.values()).map((input: Utxo) => ({
    label: input.label || '',
    previousOutput: { txid: input.txid, vout: input.vout },
    scriptSig: '' as string | number[],
    sequence: 0,
    value: input.value,
    witness: [] as number[][]
  }))

  const vout = outputs.map((output: Output) => ({
    address: output.to,
    kind: output.kind,
    label: output.label || '',
    script: '' as string | number[],
    value: output.amount
  }))

  return {
    id: psbt.txid(),
    lockTimeEnabled: false,
    prices: {},
    received: 0,
    sent: 0,
    size,
    type: 'send' as const,
    vin,
    vout,
    vsize
  }
}

function getBdkInnerMessage(error: unknown): string | undefined {
  if (!(error instanceof Error) || !('inner' in error)) {
    return undefined
  }
  const record = error as { inner?: unknown }
  const { inner } = record
  if (!inner || typeof inner !== 'object' || !('message' in inner)) {
    return undefined
  }
  const msg = (inner as { message: unknown }).message
  if (typeof msg !== 'string' || msg.length === 0) {
    return undefined
  }
  return msg
}

function broadcastFailureUserMessage(error: unknown): string {
  const inner = getBdkInnerMessage(error)
  if (inner) {
    return inner
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Failed to broadcast transaction'
}

export default function SignTransaction() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const [
    psbt,
    setPsbt,
    signedTx,
    signedPsbtBase64,
    setSignedTx,
    inputs,
    outputs,
    broadcasted,
    setBroadcasted,
    payjoinUri
  ] = useTransactionBuilderStore(
    useShallow((state) => [
      state.psbt,
      state.setPsbt,
      state.signedTx,
      state.signedPsbtBase64,
      state.setSignedTx,
      state.inputs,
      state.outputs,
      state.broadcasted,
      state.setBroadcasted,
      state.payjoinUri
    ])
  )
  const payjoinEnabled = useSettingsStore((s) => s.payjoinEnabled)
  const payjoinCoordinationMode = useSettingsStore(
    (s) => s.payjoinCoordinationMode
  )
  const isManualPayjoin = payjoinCoordinationMode === 'manual'
  const senderSessionExpiresAt = usePayjoinSessionsStore((state) =>
    id ? state.getActiveSenderSession(id)?.expiresAt : undefined
  )
  const nowMs = useNow()
  const payjoinExpiringLabel = formatPayjoinExpiringLabel(
    senderSessionExpiresAt,
    nowMs
  )
  const [payjoinStatus, setPayjoinStatus] = useState<string | null>(null)
  const [waitingForReceiver, setWaitingForReceiver] = useState(false)
  const [checkingPayjoin, setCheckingPayjoin] = useState(false)
  const [manualOriginalPsbt, setManualOriginalPsbt] = useState<string | null>(
    null
  )
  const [manualBusy, setManualBusy] = useState(false)
  const payjoinBusyRef = useRef(false)
  const account = useAccountsStore(
    useShallow((state) => state.accounts.find((account) => account.id === id))
  )
  const ownAddresses = new Set(account?.addresses?.map((a) => a.address))
  const txLabelsById = useMemo(
    () => buildTxLabelsById(account?.transactions),
    [account?.transactions]
  )
  const knownTxIds = useMemo(
    () => buildKnownTxIds(account?.transactions),
    [account?.transactions]
  )
  const outpointLabelsByRef = useMemo(
    () => buildOutpointLabelsByRef(account ?? {}),
    [account]
  )
  const setTransactionToShare = useNostrStore(
    (state) => state.setTransactionToShare
  )
  const wallet = useGetAccountWallet(id!)
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )

  const currentConfig = configs[selectedNetwork]

  const [signed, setSigned] = useState(false)
  const [broadcasting, setBroadcasting] = useState(false)
  const [rawTx, setRawTx] = useState('')

  const trimmedRawTx = rawTx.trim()
  const canCopySignedTx =
    signed &&
    !!rawTx &&
    trimmedRawTx.length >= 20 &&
    /^[0-9a-fA-F]+$/.test(trimmedRawTx) &&
    !trimmedRawTx.toLowerCase().startsWith('70736274')

  async function handleCopySignedTx() {
    if (!canCopySignedTx) {
      toast.error(tn('copySignedTxUnavailable'))
      return
    }
    try {
      await Clipboard.setStringAsync(trimmedRawTx)
      toast.success(t('common.copiedToClipboard'))
    } catch {
      toast.error(tn('copySignedTxUnavailable'))
    }
  }

  // Payjoin keeps two wallets + OHTTP state hot on 2GB AVDs. Remounting Skia
  // after the proposal is signed (waiting → signed), and again right after
  // setBroadcasted(true) before navigate, was spiking RSS into LMK.
  // Keep the chart off during directory wait or Manual handoff.
  const suppressTransactionChart =
    waitingForReceiver || !!payjoinStatus || !!manualOriginalPsbt

  const transaction = suppressTransactionChart
    ? null
    : buildSignTransactionChartModel(psbt ?? null, inputs, outputs, rawTx)

  function handleBroadcastSingleSig() {
    if (!psbt || !wallet) {
      throw new Error('Empty PSBT or wallet')
    }
    return broadcastTransaction(
      wallet,
      psbt,
      currentConfig.server.backend,
      currentConfig.server.url,
      currentConfig.server.rpcCredentials
    ).then((txid) => txid)
  }

  async function handleBroadcastMultiSig() {
    if (!signedTx) {
      throw new Error('Empty signed transaction')
    }

    if (typeof signedTx !== 'string' || signedTx.length === 0) {
      throw new Error('Invalid signedTx: empty or invalid format')
    }

    if (!/^[a-fA-F0-9]+$/.test(signedTx)) {
      throw new Error('Invalid signedTx: not a valid hex string')
    }

    if (signedTx.length < 100) {
      throw new Error('Invalid signedTx: too short to be a valid transaction')
    }

    if (currentConfig.server.backend === 'electrum') {
      const electrumClient = await ElectrumClient.initClientFromUrl(
        currentConfig.server.url,
        selectedNetwork
      )
      await electrumClient.broadcastTransactionHex(signedTx)
      electrumClient.close()
      return true
    }

    if (currentConfig.server.backend === 'esplora') {
      const esploraClient = new Esplora(currentConfig.server.url)
      await esploraClient.broadcastTransaction(signedTx)
      return true
    }

    if (currentConfig.server.backend === 'rpc') {
      const rpc = new BitcoinRpc(
        currentConfig.server.url,
        currentConfig.server.rpcCredentials?.username ?? '',
        currentConfig.server.rpcCredentials?.password ?? ''
      )
      await rpc.sendRawTransaction(signedTx)
      return true
    }

    throw new Error(`Unsupported backend: ${currentConfig.server.backend}`)
  }

  async function handleBroadcastTransaction() {
    if (broadcasting) {
      toast.info('Please wait while the transaction is being broadcast.')
      return
    }

    if (broadcasted) {
      toast.error(
        'This transaction has already been broadcasted to the network'
      )
      return
    }

    setBroadcasting(true)

    try {
      if (signedTx) {
        await handleBroadcastMultiSig()
      } else if (psbt) {
        const broadcastResult = await handleBroadcastSingleSig()
        if (!broadcastResult) {
          throw new Error('Broadcast failed')
        }
      } else {
        throw new Error('No transaction to broadcast')
      }

      setBroadcasted(true)
      if (id) {
        const store = usePayjoinSessionsStore.getState()
        for (const session of store.sessions) {
          if (session.accountId === id && session.role === 'sender') {
            store.updateSessionStatus(session.id, 'completed')
          }
        }
      }
      router.navigate(
        `/signer/bitcoin/account/${id}/signAndSend/transactionConfirmation`
      )
    } catch (error) {
      toast.error(broadcastFailureUserMessage(error))
    } finally {
      setBroadcasting(false)
    }
  }

  function handleShareWithNostrGroup() {
    if (!account?.nostr?.autoSync) {
      toast.error(t('account.nostrSync.autoSyncMustBeEnabled'))
      return
    }
    const txString = psbt?.toBase64() ?? signedTx ?? ''
    if (!txString) {
      toast.error(t('account.nostrSync.transactionDataNotAvailable'))
      return
    }
    setTransactionToShare({
      transaction: txString,
      transactionData: { combinedPsbt: txString }
    })
    router.push({
      params: { id },
      pathname: '/signer/bitcoin/account/[id]/settings/nostr/devicesGroupChat'
    })
  }

  const paymentAmountSats = useMemo(
    () =>
      outputs.reduce(
        (sum, o) =>
          sum + (o.kind === 'change' || o.kind === 'fakeMix' ? 0 : o.amount),
        0
      ),
    [outputs]
  )

  const payjoinPollUrl = useMemo(() => {
    if (!payjoinUri || !hasPayjoinParam(payjoinUri)) {
      return null
    }
    const fromSession = id
      ? usePayjoinSessionsStore.getState().getActiveSenderSession(id)
          ?.pjEndpoint
      : undefined
    const raw =
      fromSession ||
      parsePayjoinUri(payjoinUri).params?.pj ||
      PAYJOIN_DIRECTORY_URL
    return raw.split('#')[0] || PAYJOIN_DIRECTORY_URL
  }, [id, payjoinUri])

  function buildCallbacks() {
    if (!wallet || !account) {
      throw new Error('Missing wallet or account')
    }
    const store = usePayjoinSessionsStore.getState()
    const network = bitcoinjsNetwork(account.network)
    return buildPayjoinWalletCallbacks({
      hasSeenInput: (outpoint) => store.hasSeenInput(outpoint),
      markInputSeen: (outpoint) => store.markInputSeen(outpoint),
      network,
      outputs,
      ownedAddresses: [
        ...(account.addresses ?? []).map((a) => a.address),
        ...outputs.filter((o) => o.kind === 'change').map((o) => o.to)
      ],
      signPsbt: (proposalBase64) => {
        const utxos = Array.from(inputs.values())
        const prepared = preparePayjoinPsbtForWalletSign({
          getPrevTxHex: (txid) => wallet.getTx(txid),
          psbtBase64: proposalBase64,
          utxos
        })
        const proposal = new Psbt(prepared)
        signTransaction(proposal, wallet)
        return proposal.toBase64()
      },
      transactions: account.transactions ?? [],
      utxos: Array.from(inputs.values())
    })
  }

  function applyPayjoinProposal(psbtBase64: string) {
    const payjoinPsbt = new Psbt(psbtBase64)
    const hex = payjoinPsbt.extractTxHex()
    setPsbt(payjoinPsbt)
    // Persist into the draft so a crash mid-broadcast can resume signed.
    setSignedTx(hex, psbtBase64)
    setSigned(true)
    setRawTx(hex)
    setWaitingForReceiver(false)
    setPayjoinStatus(t('transaction.build.payjoin.success'))
    toast.success(t('transaction.build.payjoin.success'))
  }

  function signOriginalTransaction() {
    if (!wallet || !psbt) {
      return
    }
    signTransaction(psbt, wallet)
    const signedBase64 = psbt.toBase64()
    const signedPsbt = new Psbt(signedBase64)
    const hex = signedPsbt.extractTxHex()
    setSigned(true)
    setPsbt(signedPsbt)
    setSignedTx(hex, signedBase64)
    setRawTx(hex)
    setWaitingForReceiver(false)
    setPayjoinStatus(null)
  }

  function enterWaitingForReceiver() {
    setWaitingForReceiver(true)
    setPayjoinStatus(t('transaction.build.payjoin.waitingReceiver'))
  }

  async function pollPersistedSender(session: PayjoinSession) {
    if (!wallet || !account || payjoinBusyRef.current || signed) {
      return
    }
    payjoinBusyRef.current = true
    setCheckingPayjoin(true)
    setPayjoinStatus(t('transaction.build.payjoin.negotiating'))
    try {
      const parsed = parsePayjoinUri(session.uri || payjoinUri || '')
      const disableOutputSubstitution =
        (parsed.params?.pjos ?? session.pjos) === 0
      const result = await pollBip77Send({
        callbacks: buildCallbacks(),
        disableOutputSubstitution,
        paymentAmountSats: session.amountSats ?? paymentAmountSats,
        session,
        timeoutMs: 15_000
      })
      payjoinLog('ui pollBip77Send result', {
        kind: result.kind,
        mailbox: mailboxFromUri(session.uri)
      })
      if (result.kind === 'proposal') {
        applyPayjoinProposal(result.result.psbtBase64)
        return
      }
      if (result.kind === 'waiting') {
        enterWaitingForReceiver()
        return
      }
      payjoinWarn('ui poll fallback', {
        mailbox: mailboxFromUri(session.uri),
        reason: compactError(result.reason)
      })
      toast.warning(t('transaction.build.payjoin.fallback'))
      signOriginalTransaction()
    } catch (error) {
      payjoinWarn('ui poll threw', { error: compactError(error) })
      toast.warning(t('transaction.build.payjoin.fallback'))
      signOriginalTransaction()
    } finally {
      payjoinBusyRef.current = false
      setCheckingPayjoin(false)
    }
  }

  function skipPayjoinAndSign() {
    const session = id
      ? usePayjoinSessionsStore.getState().getActiveSenderSession(id)
      : undefined
    if (session) {
      usePayjoinSessionsStore
        .getState()
        .updateSessionStatus(session.id, 'fallback', {
          error: 'user skipped payjoin',
          nativeState: undefined
        })
    }
    setManualOriginalPsbt(null)
    toast.warning(t('transaction.build.payjoin.fallback'))
    signOriginalTransaction()
  }

  async function handleImportManualProposal(proposalPsbtBase64: string) {
    if (!manualOriginalPsbt || !wallet || !account) {
      return
    }
    setManualBusy(true)
    try {
      const callbacks = buildCallbacks()
      const result = await applyManualSenderProposal({
        callbacks,
        disableOutputSubstitution: PAYJOIN_DEFAULT_PJOS === 0,
        originalPsbtBase64: manualOriginalPsbt,
        paymentAmountSats,
        proposalPsbtBase64
      })
      if (!result.ok || !result.usedPayjoin) {
        toast.error(
          result.ok
            ? (result.reason ?? t('transaction.build.payjoin.fallback'))
            : result.error
        )
        return
      }
      setManualOriginalPsbt(null)
      applyPayjoinProposal(result.psbtBase64)
    } finally {
      setManualBusy(false)
    }
  }

  function enterManualPayjoinHandoff() {
    if (!psbt) {
      return
    }
    const originalBase64 = psbt.toBase64()
    setManualOriginalPsbt(originalBase64)
    setPayjoinStatus(t('transaction.build.payjoin.manual.waiting'))
    setWaitingForReceiver(false)
  }

  async function startOrResumePayjoinSign() {
    if (signedTx) {
      setSigned(true)
      setRawTx(signedTx)
      if (!psbt && signedPsbtBase64) {
        setPsbt(new Psbt(signedPsbtBase64))
      }
      return
    }
    if (
      !wallet ||
      !psbt ||
      !account ||
      !id ||
      signed ||
      payjoinBusyRef.current ||
      manualOriginalPsbt
    ) {
      return
    }

    if (
      payjoinEnabled &&
      isManualPayjoin &&
      account.policyType === 'singlesig'
    ) {
      enterManualPayjoinHandoff()
      return
    }

    const shouldPayjoin =
      payjoinEnabled &&
      !isManualPayjoin &&
      account.policyType === 'singlesig' &&
      !!payjoinUri &&
      hasPayjoinParam(payjoinUri)

    if (!shouldPayjoin || !payjoinUri) {
      signOriginalTransaction()
      return
    }

    const activeSender = usePayjoinSessionsStore
      .getState()
      .getActiveSenderSession(id)
    if (activeSender) {
      await pollPersistedSender(activeSender)
      return
    }

    payjoinBusyRef.current = true
    setPayjoinStatus(t('transaction.build.payjoin.negotiating'))
    try {
      const originalBase64 = psbt.toBase64()
      const callbacks = buildCallbacks()
      const parsed = parsePayjoinUri(payjoinUri)
      const endpointKind =
        parsed.endpointKind ??
        (parsed.params ? detectEndpointKind(parsed.params.pj) : 'bip77')

      // BIP78 needs an always-on endpoint — keep the blocking path.
      if (endpointKind === 'bip78') {
        payjoinLog('ui sendPayjoin start (bip78)', {
          mailbox: mailboxFromUri(payjoinUri)
        })
        const result = await sendPayjoin({
          accountId: id,
          callbacks,
          originalPsbtBase64: originalBase64,
          outputScriptsHex: callbacks.outputScriptsHex,
          payjoinUri,
          paymentAmountSats
        })
        payjoinLog('ui sendPayjoin result', {
          ok: result.ok,
          usedPayjoin: result.ok ? result.usedPayjoin : false
        })
        if (result.ok && result.usedPayjoin) {
          applyPayjoinProposal(result.psbtBase64)
          return
        }
        payjoinWarn('ui bip78 fallback', {
          reason: result.ok ? result.reason : result.error
        })
        toast.warning(t('transaction.build.payjoin.fallback'))
        signOriginalTransaction()
        return
      }

      // BIP77: post original, then allow switching to Receive and resume.
      payjoinLog('ui startBip77Send', {
        amountSats: paymentAmountSats,
        mailbox: mailboxFromUri(payjoinUri)
      })
      const started = await startBip77Send({
        accountId: id,
        callbacks,
        disableOutputSubstitution:
          (parsed.params?.pjos ?? PAYJOIN_DEFAULT_PJOS) === 0,
        originalPsbtBase64: originalBase64,
        payjoinUri,
        paymentAmountSats,
        quickPollMs: 3_000
      })
      payjoinLog('ui startBip77Send result', {
        kind: started.kind,
        mailbox: mailboxFromUri(payjoinUri),
        reason:
          started.kind === 'fallback' ? compactError(started.reason) : undefined
      })

      if (started.kind === 'proposal') {
        applyPayjoinProposal(started.result.psbtBase64)
        return
      }
      if (started.kind === 'waiting') {
        enterWaitingForReceiver()
        return
      }
      payjoinWarn('ui start fallback', {
        mailbox: mailboxFromUri(payjoinUri),
        reason: compactError(started.reason)
      })
      toast.warning(t('transaction.build.payjoin.fallback'))
      signOriginalTransaction()
    } catch (error) {
      payjoinWarn('ui send threw', { error: compactError(error) })
      toast.warning(t('transaction.build.payjoin.fallback'))
      signOriginalTransaction()
    } finally {
      payjoinBusyRef.current = false
    }
  }

  useFocusEffect(
    useCallback(() => {
      void startOrResumePayjoinSign()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps
  )

  function handleCheckPayjoinResponse() {
    if (!id) {
      return
    }
    const session = usePayjoinSessionsStore
      .getState()
      .getActiveSenderSession(id)
    if (!session) {
      toast.warning(t('transaction.build.payjoin.fallback'))
      signOriginalTransaction()
      return
    }
    void pollPersistedSender(session)
  }

  function handleOpenAccounts() {
    // replace avoids remounting signAndSend layouts with a missing account id
    // (that crashed on account.name during dismiss/navigate transitions).
    router.replace('/signer/bitcoin/accountList')
  }

  if (!account || !psbt) {
    return <Redirect href="/" />
  }

  return (
    <>
      <SSMainLayout style={{ paddingBottom: 20, paddingTop: 0 }}>
        <ScrollView>
          <SSVStack justifyBetween style={{ minHeight: '100%' }}>
            <SSVStack itemsCenter>
              {!signed && payjoinStatus ? (
                <SSVStack gap="xxs" itemsCenter>
                  <SSHStack
                    gap="sm"
                    style={{ alignItems: 'center', justifyContent: 'center' }}
                  >
                    <SSLoader size={18} />
                    <SSText
                      testID="send-payjoin-status"
                      color="muted"
                      size="sm"
                      center
                    >
                      {payjoinStatus}
                    </SSText>
                  </SSHStack>
                  {waitingForReceiver ? (
                    <SSText
                      color="muted"
                      size="sm"
                      style={{ textAlign: 'center' }}
                    >
                      {t('transaction.build.payjoin.waitingReceiverHint')}
                    </SSText>
                  ) : null}
                  {payjoinExpiringLabel ? (
                    <SSText
                      testID="send-payjoin-expiring"
                      color="muted"
                      size="xs"
                      center
                    >
                      {payjoinExpiringLabel}
                    </SSText>
                  ) : null}
                  {payjoinPollUrl ? (
                    <SSText
                      testID="send-payjoin-poll-url"
                      color="muted"
                      size="xs"
                      center
                    >
                      {payjoinPollUrl}
                    </SSText>
                  ) : null}
                </SSVStack>
              ) : (
                <SSText
                  testID="send-payjoin-status"
                  size="md"
                  uppercase
                  weight="light"
                >
                  {broadcasted
                    ? t('sent.broadcasted')
                    : account?.policyType === 'multisig' && signedTx
                      ? tn('readyToBroadcast')
                      : tn(signed ? 'signed' : 'signing')}
                </SSText>
              )}

              {signed && !broadcasted && (
                <SSIconSuccess width={159} height={159} variant="outline" />
              )}
              {!signed && !broadcasted && !payjoinStatus ? (
                <SSLoader size={160} />
              ) : null}
              {broadcasted && <SSSuccessCheckAnimation />}
            </SSVStack>

            <SSVStack>
              <SSVStack gap="xxs">
                <SSText color="muted" size="sm" uppercase>
                  {t('transaction.id')}
                </SSText>
                <SSTransactionIdFormatted size="lg" value={psbt.txid()} />
              </SSVStack>

              <SSVStack gap="xxs">
                <SSText color="muted" size="sm" uppercase>
                  {t('transaction.build.preview.contents')}
                </SSText>
                {transaction ? (
                  <View style={{ overflow: 'hidden', width: '100%' }}>
                    <SSTransactionChart
                      accountId={id}
                      transaction={transaction}
                      ownAddresses={ownAddresses}
                      txLabelsById={txLabelsById}
                      knownTxIds={knownTxIds}
                      outpointLabelsByRef={outpointLabelsByRef}
                      scale={0.9}
                      showUnspentLabel={false}
                    />
                  </View>
                ) : null}
              </SSVStack>
              <SSVStack gap="xxs">
                <SSText color="muted" size="sm" uppercase>
                  {tn('transaction')}
                </SSText>
                {rawTx !== '' && !suppressTransactionChart ? (
                  <>
                    {(() => {
                      const isValidHex =
                        /^[a-fA-F0-9]+$/.test(rawTx) && rawTx.length >= 8

                      if (!isValidHex) {
                        return (
                          <SSText color="muted" size="sm">
                            Invalid transaction format:{' '}
                            {rawTx.substring(0, 100)}
                            ...
                          </SSText>
                        )
                      }

                      // Check if this might be PSBT data (starts with specific PSBT magic bytes)
                      const isPossiblyPSBT = rawTx
                        .toLowerCase()
                        .startsWith('70736274')

                      if (isPossiblyPSBT) {
                        return (
                          <SSText color="muted" size="sm">
                            PSBT format detected - Cannot display raw
                            transaction view. Transaction will be processed for
                            broadcasting.
                          </SSText>
                        )
                      }

                      // Try to decode as raw transaction
                      try {
                        return <SSTransactionDecoded txHex={rawTx} />
                      } catch {
                        return (
                          <SSText color="muted" size="sm">
                            Unable to decode transaction format. Data will be
                            processed for broadcasting.
                          </SSText>
                        )
                      }
                    })()}
                  </>
                ) : null}
              </SSVStack>
            </SSVStack>

            {manualOriginalPsbt && !signed ? (
              <SSVStack>
                <SSText color="muted" size="sm" center>
                  {t('transaction.build.payjoin.manual.hint')}
                </SSText>
                <SSText size="sm" uppercase center>
                  {t('transaction.build.payjoin.manual.copyOriginal')}
                </SSText>
                <SSPsbtTransport
                  mode="export"
                  testIDPrefix="send-payjoin-export"
                  psbtBase64={manualOriginalPsbt}
                  disabled={manualBusy}
                  copyLabel={t('common.copy')}
                />
                <SSText size="sm" uppercase center>
                  {t('transaction.build.payjoin.manual.pasteProposal')}
                </SSText>
                <SSPsbtTransport
                  mode="import"
                  testIDPrefix="send-payjoin-import"
                  loading={manualBusy}
                  pasteLabel={t('common.paste')}
                  onImport={handleImportManualProposal}
                />
                <SSButton
                  testID="send-payjoin-skip"
                  variant="ghost"
                  label={t('transaction.build.payjoin.skip')}
                  disabled={manualBusy}
                  onPress={skipPayjoinAndSign}
                />
              </SSVStack>
            ) : waitingForReceiver && !signed ? (
              <SSVStack>
                <SSButton
                  testID="send-payjoin-open-accounts"
                  variant="secondary"
                  label={t('transaction.build.payjoin.openAccounts')}
                  disabled={checkingPayjoin}
                  onPress={handleOpenAccounts}
                />
                <SSButton
                  testID="send-payjoin-check"
                  variant="ghost"
                  label={t('transaction.build.payjoin.checkResponse')}
                  loading={checkingPayjoin}
                  onPress={handleCheckPayjoinResponse}
                />
                <SSButton
                  testID="send-payjoin-skip"
                  variant="ghost"
                  label={t('transaction.build.payjoin.skip')}
                  disabled={checkingPayjoin}
                  onPress={skipPayjoinAndSign}
                />
              </SSVStack>
            ) : !signed && payjoinStatus ? (
              <SSButton
                testID="send-payjoin-open-accounts"
                variant="secondary"
                label={t('transaction.build.payjoin.openAccounts')}
                onPress={handleOpenAccounts}
              />
            ) : (
              <SSButton
                testID="send-broadcast"
                variant="secondary"
                label={
                  broadcasted ? t('sent.broadcasted') : t('send.broadcast')
                }
                disabled={!signed || (!psbt && !signedTx) || broadcasted}
                loading={broadcasting}
                onPress={handleBroadcastTransaction}
              />
            )}
            {signed && (
              <SSButton
                variant="ghost"
                disabled={!canCopySignedTx || broadcasting}
                label={tn('copySignedTx')}
                onPress={handleCopySignedTx}
              />
            )}
            {signed &&
              account?.nostr?.autoSync &&
              (psbt?.toBase64() ?? signedTx) && (
                <SSButton
                  variant="ghost"
                  label={t('account.nostrSync.shareWithGroup')}
                  disabled={broadcasting}
                  onPress={handleShareWithNostrGroup}
                />
              )}
          </SSVStack>
        </ScrollView>
      </SSMainLayout>
    </>
  )
}
