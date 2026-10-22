import * as ecc from '@bitcoinerlab/secp256k1'
import * as bitcoinjs from 'bitcoinjs-lib'
import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import { useCosignerSignatures } from '@/hooks/useCosignerSignatures'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type Account } from '@/types/models/Account'
import { createMockPsbt } from '@/utils/psbt'

// The pubkeys are G and 2G, so private keys 1 and 2 sign for them.
const PUBKEYS = [
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
  '02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5'
].map((pubkey) => Buffer.from(pubkey, 'hex'))
const P2WSH = bitcoinjs.payments.p2wsh({
  redeem: bitcoinjs.payments.p2ms({ m: 2, pubkeys: PUBKEYS })
})
const SIGNERS = [1, 2].map((scalar, index) => {
  const privateKey = Buffer.alloc(32)
  privateKey[31] = scalar
  return {
    publicKey: PUBKEYS[index],
    sign: (hash: Buffer) => Buffer.from(ecc.sign(hash, privateKey))
  }
})

function buildMultisigPsbt(outputValue = 90_000) {
  const script = P2WSH.output ?? Buffer.alloc(0)
  const psbt = new bitcoinjs.Psbt()
  psbt.addInput({
    hash: Buffer.alloc(32, 0x11),
    index: 0,
    witnessScript: P2WSH.redeem?.output,
    witnessUtxo: { script, value: 100_000 }
  })
  psbt.addOutput({ script, value: outputValue })
  return psbt.toBase64()
}

function signAs(cosignerIndex: number, psbtBase64: string) {
  return bitcoinjs.Psbt.fromBase64(psbtBase64)
    .signInput(0, SIGNERS[cosignerIndex])
    .toBase64()
}

function makeAccount(): Account {
  return {
    addresses: [],
    createdAt: new Date('2024-01-01'),
    displayIndex: 0,
    id: 'acc-1',
    keyCount: 2,
    keys: [0, 1].map((index) => ({
      creationType: 'importExtendedPub',
      index,
      iv: '',
      secret: ''
    })),
    keysRequired: 2,
    labels: {},
    name: 'Test',
    network: 'bitcoin',
    nostr: {
      autoSync: false,
      commonNpub: '',
      commonNsec: '',
      dms: [],
      lastUpdated: new Date(),
      relays: [],
      syncStart: new Date(),
      trustedMemberDevices: []
    },
    policyType: 'multisig',
    summary: {
      balance: 0,
      numberOfAddresses: 0,
      numberOfTransactions: 0,
      numberOfUtxos: 0,
      satsInMempool: 0
    },
    syncStatus: 'synced',
    transactions: [],
    utxos: []
  }
}

const mounted: ReactTestRenderer[] = []

type CosignerSignatures = ReturnType<typeof useCosignerSignatures>

async function renderCosignerSignatures() {
  const onNotice = jest.fn()
  const account = makeAccount()
  const hook: { current: CosignerSignatures | null } = { current: null }
  function Harness() {
    hook.current = useCosignerSignatures({
      account,
      decryptedKeys: account.keys,
      importedPsbtBase64: undefined,
      onNotice
    })
    return null
  }
  await act(async () => {
    mounted.push(create(createElement(Harness)))
  })
  return { hook, onNotice }
}

function reviewPsbt(psbtBase64: string) {
  useTransactionBuilderStore
    .getState()
    .setPsbt(createMockPsbt(psbtBase64, 'review-txid', 10_000))
}

describe('useCosignerSignatures', () => {
  beforeEach(() => {
    useTransactionBuilderStore.getState().clearTransaction()
  })

  afterEach(() => {
    act(() => {
      for (const renderer of mounted.splice(0)) {
        renderer.unmount()
      }
    })
  })

  it("stores a cosigner's signed PSBT combined with the one under review", async () => {
    const original = buildMultisigPsbt()
    reviewPsbt(original)
    const { hook } = await renderCosignerSignatures()

    act(() => {
      expect(
        hook.current?.importSignedDataMatchingPsbt(0, signAs(0, original))
      ).toBe(true)
    })

    const stored = hook.current?.signedPsbts.get(0) ?? ''
    expect(
      bitcoinjs.Psbt.fromBase64(stored).data.inputs[0].partialSig
    ).toHaveLength(1)
  })

  it('rejects a signed PSBT for a different transaction', async () => {
    reviewPsbt(buildMultisigPsbt())
    const { hook, onNotice } = await renderCosignerSignatures()

    act(() => {
      expect(
        hook.current?.importSignedDataMatchingPsbt(
          0,
          signAs(0, buildMultisigPsbt(80_000))
        )
      ).toBe(false)
    })

    expect(hook.current?.signedPsbts.has(0)).toBe(false)
    expect(onNotice).toHaveBeenCalledWith({
      key: 'common.error.transactionMismatch',
      type: 'error'
    })
  })

  it('rejects a cosigner signature while no PSBT is under review', async () => {
    useTransactionBuilderStore.getState().clearPsbt()
    const { hook, onNotice } = await renderCosignerSignatures()

    act(() => {
      expect(
        hook.current?.importSignedDataMatchingPsbt(
          0,
          signAs(0, buildMultisigPsbt())
        )
      ).toBe(false)
    })

    expect(hook.current?.signedPsbts.has(0)).toBe(false)
    expect(onNotice).toHaveBeenCalledWith({
      key: 'common.error.noOriginalPSBT',
      type: 'error'
    })
  })

  it('finalizes once every cosigner signature is collected', async () => {
    const original = buildMultisigPsbt()
    reviewPsbt(original)
    const { hook, onNotice } = await renderCosignerSignatures()

    act(() => {
      hook.current?.importSignedDataMatchingPsbt(0, signAs(0, original))
      hook.current?.importSignedDataMatchingPsbt(1, signAs(1, original))
    })
    const result: { hex: string | null | undefined } = { hex: undefined }
    act(() => {
      result.hex = hook.current?.combineAndFinalizeSignatures()
    })

    expect(result.hex).toMatch(/^[0-9a-f]+$/)
    expect(useTransactionBuilderStore.getState().signedTx).toBe(result.hex)
    expect(onNotice).toHaveBeenCalledWith({
      key: 'transaction.finalizedSuccessfully',
      type: 'success'
    })
  })

  it('does not finalize below the signature threshold', async () => {
    const original = buildMultisigPsbt()
    reviewPsbt(original)
    const { hook, onNotice } = await renderCosignerSignatures()

    act(() => {
      hook.current?.importSignedDataMatchingPsbt(0, signAs(0, original))
    })
    const result: { hex: string | null | undefined } = { hex: undefined }
    act(() => {
      result.hex = hook.current?.combineAndFinalizeSignatures()
    })

    expect(result.hex).toBeNull()
    expect(onNotice).toHaveBeenCalledWith({
      key: 'transaction.preview.notEnoughSignatures',
      params: undefined,
      type: 'error'
    })
  })

  it('combines the collected signatures to share them', async () => {
    const original = buildMultisigPsbt()
    reviewPsbt(original)
    const { hook } = await renderCosignerSignatures()

    act(() => {
      hook.current?.importSignedDataMatchingPsbt(1, signAs(1, original))
    })
    const combined = hook.current?.combineCollectedSignaturesForSharing() ?? ''

    expect(
      bitcoinjs.Psbt.fromBase64(combined).data.inputs[0].partialSig?.[0].pubkey
    ).toStrictEqual(PUBKEYS[1])
  })

  it('reports that there is nothing to share without a PSBT', async () => {
    const { hook, onNotice } = await renderCosignerSignatures()

    expect(hook.current?.combineCollectedSignaturesForSharing()).toBeNull()
    expect(onNotice).toHaveBeenCalledWith({
      key: 'account.nostrSync.transactionDataNotAvailable',
      type: 'error'
    })
  })
})
