import * as ecc from '@bitcoinerlab/secp256k1'
import * as bitcoinjs from 'bitcoinjs-lib'

import { findSignedPsbtsPerCosignerInPsbt } from '@/services/cosignerSignatures'
import { type Account } from '@/types/models/Account'

const FINGERPRINTS = ['aaaaaaaa', 'bbbbbbbb']

// Each input pays to its own 2-of-2 address: cosigner 0 signs with the first
// scalar and cosigner 1 with the second.
const INPUT_SIGNER_SCALARS = [
  [1, 2],
  [3, 4]
]

function makeSigner(scalar: number) {
  const privateKey = Buffer.alloc(32)
  privateKey[31] = scalar
  const publicKey = Buffer.from(ecc.pointFromScalar(privateKey) ?? [])
  return {
    publicKey,
    sign: (hash: Buffer) => Buffer.from(ecc.sign(hash, privateKey))
  }
}

const INPUT_SIGNERS = INPUT_SIGNER_SCALARS.map((scalars) =>
  scalars.map(makeSigner)
)

function buildMultisigPsbt(inputCount = 1) {
  const psbt = new bitcoinjs.Psbt()
  for (const [inputIndex, signers] of INPUT_SIGNERS.slice(
    0,
    inputCount
  ).entries()) {
    const pubkeys = signers.map((signer) => signer.publicKey)
    const p2wsh = bitcoinjs.payments.p2wsh({
      redeem: bitcoinjs.payments.p2ms({ m: 2, pubkeys })
    })
    psbt.addInput({
      bip32Derivation: pubkeys.map((pubkey, cosignerIndex) => ({
        masterFingerprint: Buffer.from(FINGERPRINTS[cosignerIndex], 'hex'),
        path: `m/48'/0'/0'/2'/0/${inputIndex}`,
        pubkey
      })),
      hash: Buffer.alloc(32, 0x11),
      index: inputIndex,
      witnessScript: p2wsh.redeem?.output,
      witnessUtxo: { script: p2wsh.output ?? Buffer.alloc(0), value: 100_000 }
    })
  }
  psbt.addOutput({
    address: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    value: 90_000
  })
  return psbt.toBase64()
}

function signAs(cosignerIndex: number, psbtBase64: string) {
  const psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)
  for (const inputIndex of psbt.txInputs.keys()) {
    psbt.signInput(inputIndex, INPUT_SIGNERS[inputIndex][cosignerIndex])
  }
  return psbt.toBase64()
}

function countSignedInputs(psbtBase64: string) {
  return bitcoinjs.Psbt.fromBase64(psbtBase64).data.inputs.filter(
    (input) => (input.partialSig?.length ?? 0) > 0
  ).length
}

function makeAccount(): Account {
  return {
    addresses: [],
    createdAt: new Date('2024-01-01'),
    displayIndex: 0,
    id: 'acc-1',
    keyCount: 2,
    keys: FINGERPRINTS.map((fingerprint, index) => ({
      creationType: 'importExtendedPub',
      fingerprint,
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

describe('findSignedPsbtsPerCosignerInPsbt', () => {
  const account = makeAccount()

  it('matches a signature to its cosigner by fingerprint', async () => {
    const signedPsbts = await findSignedPsbtsPerCosignerInPsbt({
      account,
      decryptedKeys: account.keys,
      existingSignedPsbts: new Map(),
      partiallySignedPsbtBase64: signAs(1, buildMultisigPsbt())
    })

    expect([...signedPsbts.keys()]).toStrictEqual([1])
  })

  it('keeps every input a cosigner signed in one PSBT', async () => {
    const signedPsbts = await findSignedPsbtsPerCosignerInPsbt({
      account,
      decryptedKeys: account.keys,
      existingSignedPsbts: new Map(),
      partiallySignedPsbtBase64: signAs(0, buildMultisigPsbt(2))
    })

    expect([...signedPsbts.keys()]).toStrictEqual([0])
    expect(countSignedInputs(signedPsbts.get(0) ?? '')).toBe(2)
  })

  it('skips cosigners that already have a signature', async () => {
    const signedPsbts = await findSignedPsbtsPerCosignerInPsbt({
      account,
      decryptedKeys: account.keys,
      existingSignedPsbts: new Map([[1, 'already-signed']]),
      partiallySignedPsbtBase64: signAs(1, buildMultisigPsbt())
    })

    expect(signedPsbts.size).toBe(0)
  })

  it('finds nothing in an unsigned PSBT', async () => {
    const signedPsbts = await findSignedPsbtsPerCosignerInPsbt({
      account,
      decryptedKeys: account.keys,
      existingSignedPsbts: new Map(),
      partiallySignedPsbtBase64: buildMultisigPsbt()
    })

    expect(signedPsbts.size).toBe(0)
  })
})
