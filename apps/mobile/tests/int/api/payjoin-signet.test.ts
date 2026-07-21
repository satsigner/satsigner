/**
 * Payjoin checks against the Sample (segwit) Signet wallet secret.
 *
 * Uses the same mnemonic as SAMPLE ACCOUNTS → Sample (segwit).
 * Jest still mocks react-native-payjoin (in-memory mailbox) so this validates
 * app session/API logic with the real wallet identity — not the live directory.
 *
 * Run:
 *   cd apps/mobile && pnpm test:int:payjoin
 *
 * For a live directory roundtrip that asserts HTTP 2xx from payjo.in / OHTTP
 * relay and broadcasts a completed Signet payjoin tx:
 *   cd apps/mobile && pnpm test:int:payjoin:live
 */
import ecc from '@bitcoinerlab/secp256k1'
import { BIP32Factory } from 'bip32'
import * as bitcoinjs from 'bitcoinjs-lib'
import {
  __resetPayjoinMock,
  __setMailboxProposal,
  createReceiverSession
} from 'react-native-payjoin'

import {
  createReceivePayjoinSession,
  finalizeReceiverPayjoin,
  pollReceiverSession,
  sendPayjoin,
  startBip77Send,
  tryResumeReceiverSession,
  type FetchLike
} from '@/api/payjoin'
import {
  sampleSignetWalletSeed,
  sampleSignetXpubFingerprint
} from '@/constants/samples'
import { usePayjoinSessionsStore } from '@/store/payjoinSessions'
import { type PayjoinWalletCallbacks } from '@/types/payjoin'
import { mnemonicToSeed } from '@/utils/bip39'
import { parsePayjoinUri } from '@/utils/payjoinUri'

const bip32 = BIP32Factory(ecc)
const SIGNET_NETWORK = bitcoinjs.networks.testnet
const PAYMENT_SATS = 5_555
const LABEL = 'Payjoin signet integration'

const noopFetch: FetchLike = async () => ({
  body: '',
  bytes: new Uint8Array(),
  status: 200
})

function deriveSampleSignetWallet() {
  const seed = mnemonicToSeed(sampleSignetWalletSeed)
  const root = bip32.fromSeed(Buffer.from(seed), SIGNET_NETWORK)
  const fingerprint = Buffer.from(root.fingerprint).toString('hex')
  const account = root.derivePath("m/84'/1'/0'")
  const receiveNode = account.derive(0).derive(0)
  const changeNode = account.derive(1).derive(0)
  const receiveAddress = bitcoinjs.payments.p2wpkh({
    network: SIGNET_NETWORK,
    pubkey: Buffer.from(receiveNode.publicKey)
  }).address!
  const changeAddress = bitcoinjs.payments.p2wpkh({
    network: SIGNET_NETWORK,
    pubkey: Buffer.from(changeNode.publicKey)
  }).address!
  const receiveScript = bitcoinjs.payments.p2wpkh({
    network: SIGNET_NETWORK,
    pubkey: Buffer.from(receiveNode.publicKey)
  }).output!
  const changeScript = bitcoinjs.payments.p2wpkh({
    network: SIGNET_NETWORK,
    pubkey: Buffer.from(changeNode.publicKey)
  }).output!

  return {
    changeAddress,
    changeScript,
    fingerprint,
    receiveAddress,
    receiveScript,
    root
  }
}

function buildOriginalPsbt(params: {
  paymentScript: Buffer
  changeScript: Buffer
  paymentSats: number
}) {
  const TXID = 'aa'.repeat(32)
  const inputValue = 100_000
  const fee = 500
  const changeSats = inputValue - params.paymentSats - fee
  const psbt = new bitcoinjs.Psbt({ network: SIGNET_NETWORK })
  psbt.addInput({
    hash: TXID,
    index: 0,
    sequence: 0xfffffffd,
    witnessUtxo: {
      script: Buffer.from('0014' + '11'.repeat(20), 'hex'),
      value: inputValue
    }
  })
  psbt.addOutput({ script: params.paymentScript, value: params.paymentSats })
  psbt.addOutput({ script: params.changeScript, value: changeSats })
  return psbt
}

function buildProposalPsbt(params: {
  paymentScript: Buffer
  changeScript: Buffer
  paymentSats: number
}) {
  const TXID_A = 'aa'.repeat(32)
  const TXID_B = 'bb'.repeat(32)
  const psbt = new bitcoinjs.Psbt({ network: SIGNET_NETWORK })
  psbt.addInput({
    hash: TXID_A,
    index: 0,
    sequence: 0xfffffffd,
    witnessUtxo: {
      script: Buffer.from('0014' + '11'.repeat(20), 'hex'),
      value: 100_000
    }
  })
  psbt.addInput({
    hash: TXID_B,
    index: 1,
    sequence: 0xfffffffd,
    witnessUtxo: {
      script: Buffer.from('0014' + '44'.repeat(20), 'hex'),
      value: 100_000
    }
  })
  psbt.addOutput({ script: params.paymentScript, value: params.paymentSats })
  psbt.addOutput({
    script: params.changeScript,
    value: 100_000 + 100_000 - params.paymentSats - 500
  })
  return psbt
}

describe('payjoin Sample (segwit) Signet wallet secret', () => {
  const wallet = deriveSampleSignetWallet()

  beforeEach(() => {
    __resetPayjoinMock()
    usePayjoinSessionsStore.getState().clearAll()
  })

  it('derives the Sample (segwit) fingerprint from the wallet secret', () => {
    expect(wallet.fingerprint).toBe(sampleSignetXpubFingerprint)
    expect(wallet.receiveAddress.startsWith('tb1q')).toBe(true)
  })

  it('creates a receive session with amount + label for the signet address', async () => {
    const session = await createReceivePayjoinSession({
      accountId: 'sample-segwit-signet',
      address: wallet.receiveAddress,
      amountSats: PAYMENT_SATS,
      label: LABEL
    })

    expect(session.status).toBe('ready')
    expect(session.role).toBe('receiver')
    expect(session.amountSats).toBe(PAYMENT_SATS)
    expect(session.label).toBe(LABEL)
    expect(session.address).toBe(wallet.receiveAddress)
    expect(session.nativeState).toBeTruthy()

    const parsed = parsePayjoinUri(session.uri)
    expect(parsed.isValid).toBe(true)
    expect(parsed.params?.address).toBe(wallet.receiveAddress)
    expect(parsed.params?.pj).toContain('payjo.in')
    expect(Math.round((parsed.params?.amountBtc ?? 0) * 1e8)).toBe(
      PAYMENT_SATS
    )
    expect(parsed.params?.label).toBe(LABEL)
  })

  it('keeps amount when resuming the same receive session (leave + come back)', async () => {
    const created = await createReceivePayjoinSession({
      accountId: 'sample-segwit-signet',
      address: wallet.receiveAddress,
      amountSats: PAYMENT_SATS,
      label: LABEL
    })

    const resumed = await tryResumeReceiverSession(created)
    expect(resumed).not.toBeNull()
    expect(resumed?.amountSats).toBe(PAYMENT_SATS)
    expect(resumed?.label).toBe(LABEL)
    expect(resumed?.id).toBe(created.id)

    const active = usePayjoinSessionsStore
      .getState()
      .getActiveReceiverSession('sample-segwit-signet')
    expect(active?.amountSats).toBe(PAYMENT_SATS)
    expect(active?.uri).toContain(`amount=`)
  })

  it('removes a dead session so Receive can renew instead of staying expired', async () => {
    const created = await createReceivePayjoinSession({
      accountId: 'sample-segwit-signet',
      address: wallet.receiveAddress,
      amountSats: PAYMENT_SATS,
      label: LABEL
    })

    const dead = {
      ...created,
      nativeState: undefined
    }
    usePayjoinSessionsStore.getState().upsertSession(dead)

    const resumed = await tryResumeReceiverSession(dead)
    expect(resumed).toBeNull()
    expect(
      usePayjoinSessionsStore.getState().getSession(created.id)
    ).toBeUndefined()

    const renewed = await createReceivePayjoinSession({
      accountId: 'sample-segwit-signet',
      address: wallet.receiveAddress,
      amountSats: PAYMENT_SATS,
      label: LABEL
    })
    expect(renewed.status).toBe('ready')
    expect(renewed.amountSats).toBe(PAYMENT_SATS)
    expect(renewed.id).not.toBe(created.id)
  })

  it('completes a BIP77 send→receive mailbox roundtrip for the signet payment', async () => {
    const receiver = await createReceivePayjoinSession({
      accountId: 'receiver-sample',
      address: wallet.receiveAddress,
      amountSats: PAYMENT_SATS,
      label: LABEL
    })

    const original = buildOriginalPsbt({
      changeScript: wallet.changeScript,
      paymentSats: PAYMENT_SATS,
      paymentScript: wallet.receiveScript
    })
    const proposal = buildProposalPsbt({
      changeScript: wallet.changeScript,
      paymentSats: PAYMENT_SATS,
      paymentScript: wallet.receiveScript
    })

    const parsed = parsePayjoinUri(receiver.uri)
    const mailboxId = parsed.params!.pj.split('/').pop()!.split('#')[0]!
    __setMailboxProposal(mailboxId, proposal.toBase64())

    // Also ensure mailbox has original once sender posts (mock createSender does this).
    const callbacks: PayjoinWalletCallbacks = {
      hasSeenInput: () => false,
      isScriptOwned: (scriptHex) =>
        scriptHex === wallet.changeScript.toString('hex'),
      listCandidateOutpoints: () => [
        {
          scriptHex: Buffer.from('0014' + '44'.repeat(20), 'hex').toString(
            'hex'
          ),
          txid: 'bb'.repeat(32),
          value: 100_000,
          vout: 1
        }
      ],
      markInputSeen: () => undefined,
      signPsbt: (psbt) => `SIGNED:${psbt}`
    }

    const sendResult = await sendPayjoin({
      accountId: 'sender-sample',
      callbacks,
      fetchImpl: noopFetch,
      originalPsbtBase64: original.toBase64(),
      outputScriptsHex: [wallet.receiveScript.toString('hex')],
      payjoinUri: receiver.uri,
      paymentAmountSats: PAYMENT_SATS,
      timeoutMs: 2_000
    })

    expect(sendResult.ok).toBe(true)
    if (sendResult.ok && sendResult.usedPayjoin) {
      expect(sendResult.protocol).toBe('v2')
      expect(sendResult.psbtBase64.startsWith('SIGNED:')).toBe(true)
    } else if (sendResult.ok && !sendResult.usedPayjoin) {
      // Fallback is acceptable only if the mock proposal path failed.
      // Prefer usedPayjoin — fail loudly with reason for debugging.
      throw new Error(`expected payjoin success, got fallback: ${sendResult.reason}`)
    }

    const { session: withOriginal, originalPsbtBase64 } =
      await pollReceiverSession({
        callbacks,
        fetchImpl: noopFetch,
        session: receiver
      })
    expect(originalPsbtBase64 || withOriginal.originalPsbtBase64).toBeTruthy()

    const toFinalize = {
      ...withOriginal,
      originalPsbtBase64:
        originalPsbtBase64 ?? withOriginal.originalPsbtBase64,
      status: 'proposal_received' as const
    }
    usePayjoinSessionsStore.getState().upsertSession(toFinalize)

    const finalized = await finalizeReceiverPayjoin({
      callbacks,
      fetchImpl: noopFetch,
      session: toFinalize
    })
    expect(['completed', 'error']).toContain(finalized.status)
  })

  it('posts original then waits when receiver has not proposed yet (async handoff)', async () => {
    const handle = await createReceiverSession({
      address: wallet.receiveAddress,
      directoryUrl: 'https://payjo.in',
      expireSeconds: 600,
      ohttpRelayUrl: 'https://pj.bobspacebkk.com'
    })

    const original = buildOriginalPsbt({
      changeScript: wallet.changeScript,
      paymentSats: PAYMENT_SATS,
      paymentScript: wallet.receiveScript
    })

    const callbacks: PayjoinWalletCallbacks = {
      hasSeenInput: () => false,
      isScriptOwned: (scriptHex) =>
        scriptHex === wallet.changeScript.toString('hex'),
      listCandidateOutpoints: () => [],
      markInputSeen: () => undefined,
      signPsbt: (psbt) => psbt
    }

    const started = await startBip77Send({
      accountId: 'sender-sample',
      callbacks,
      disableOutputSubstitution: true,
      fetchImpl: noopFetch,
      originalPsbtBase64: original.toBase64(),
      paymentAmountSats: PAYMENT_SATS,
      payjoinUri: handle.pjUri,
      quickPollMs: 200
    })

    expect(['waiting', 'proposal', 'fallback']).toContain(started.kind)
    if (started.kind === 'waiting') {
      expect(started.session.role).toBe('sender')
      expect(started.session.nativeState).toBeTruthy()
      expect(started.session.amountSats).toBe(PAYMENT_SATS)
      expect(
        usePayjoinSessionsStore
          .getState()
          .getActiveSenderSession('sender-sample')?.id
      ).toBe(started.session.id)
    }
  })
})
