import * as bitcoinjs from 'bitcoinjs-lib'

import { type ArkExitClaimDraft } from '@/types/models/Ark'
import {
  matchesApprovedArkExitClaim,
  type VerifiedArkExitClaim,
  verifyArkExitClaimDraft,
  verifyArkExitClaimSignedTx
} from '@/utils/arkExitClaim'

const NETWORK = bitcoinjs.networks.testnet
// Taproot output keyed to the secp256k1 generator, a valid curve point.
const EXIT_SCRIPT = Buffer.from(
  '512079be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
  'hex'
)
const EXIT_ADDRESS = bitcoinjs.address.fromOutputScript(EXIT_SCRIPT, NETWORK)
const DESTINATION_SCRIPT = Buffer.from(`0014${'11'.repeat(20)}`, 'hex')
const OTHER_SCRIPT = Buffer.from(`0014${'22'.repeat(20)}`, 'hex')
const DESTINATION = bitcoinjs.address.fromOutputScript(
  DESTINATION_SCRIPT,
  NETWORK
)
const EXIT_VALUE = 50_000n
const FEE_SATS = 300
const DUMMY_SIGNATURE = Buffer.alloc(64, 1)

type ClaimInput = {
  value?: bigint
  attach?: 'witnessUtxo' | 'none'
  script?: Buffer
}

function buildExitTx(nonce: number, value: bigint): bitcoinjs.Transaction {
  const tx = new bitcoinjs.Transaction()
  tx.addInput(Buffer.alloc(32, 7), nonce)
  tx.addOutput(EXIT_SCRIPT, value)
  return tx
}

function exitOutpoint(nonce: number, value = EXIT_VALUE): string {
  return `${buildExitTx(nonce, value).getId()}:0`
}

function buildClaimPsbt(
  inputs: ClaimInput[],
  outputs: { script: Buffer; value: bigint }[]
): bitcoinjs.Psbt {
  const psbt = new bitcoinjs.Psbt({ network: NETWORK })
  for (const [
    index,
    { value = EXIT_VALUE, attach, script = EXIT_SCRIPT }
  ] of inputs.entries()) {
    psbt.addInput({
      hash: buildExitTx(index, value).getHash(),
      index: 0,
      ...(attach !== 'none' && { witnessUtxo: { script, value } })
    })
  }
  for (const output of outputs) {
    psbt.addOutput(output)
  }
  return psbt
}

function signedHexFor(psbt: bitcoinjs.Psbt): string {
  const tx = bitcoinjs.Transaction.fromBuffer(
    psbt.data.globalMap.unsignedTx.toBuffer()
  )
  for (const index of tx.ins.keys()) {
    tx.setWitness(index, [DUMMY_SIGNATURE])
  }
  return tx.toHex()
}

function claimOutput(value = EXIT_VALUE - BigInt(FEE_SATS)) {
  return { script: DESTINATION_SCRIPT, value }
}

function draftFor(
  psbt: bitcoinjs.Psbt,
  overrides: Partial<ArkExitClaimDraft> = {}
): ArkExitClaimDraft {
  return {
    feeSats: FEE_SATS,
    psbtBase64: psbt.toBase64(),
    skippedVtxoIds: [],
    vtxoIds: [exitOutpoint(0)],
    ...overrides
  }
}

function verifyDraft(
  draft: ArkExitClaimDraft,
  options: {
    requestedVtxoIds?: string[]
    address?: string
    knownAmounts?: ReadonlyMap<string, number>
  } = {}
) {
  return verifyArkExitClaimDraft({
    address: options.address ?? DESTINATION,
    draft,
    knownAmounts: options.knownAmounts ?? new Map(),
    network: 'signet',
    requestedVtxoIds: options.requestedVtxoIds ?? [exitOutpoint(0)]
  })
}

describe('verifyArkExitClaimDraft', () => {
  it('accepts a claim of the requested exits to the chosen address', () => {
    const psbt = buildClaimPsbt([{}], [claimOutput()])

    const result = verifyDraft(draftFor(psbt), {
      knownAmounts: new Map([[exitOutpoint(0), Number(EXIT_VALUE)]])
    })

    expect(result).toStrictEqual({
      amountSats: Number(EXIT_VALUE) - FEE_SATS,
      feeSats: FEE_SATS,
      inputAddresses: { [exitOutpoint(0)]: EXIT_ADDRESS },
      ok: true,
      txid: bitcoinjs.Transaction.fromHex(signedHexFor(psbt)).getId(),
      vtxoIds: [exitOutpoint(0)]
    })
  })

  it('accepts a claim of several exits', () => {
    const psbt = buildClaimPsbt(
      [{}, {}],
      [claimOutput(EXIT_VALUE * 2n - BigInt(FEE_SATS))]
    )
    const vtxoIds = [exitOutpoint(0), exitOutpoint(1)]

    const result = verifyDraft(draftFor(psbt, { vtxoIds }), {
      requestedVtxoIds: vtxoIds
    })

    expect(result).toMatchObject({ ok: true, vtxoIds })
  })

  it('rejects an unreadable psbt', () => {
    const psbt = buildClaimPsbt([{}], [claimOutput()])

    expect(
      verifyDraft(draftFor(psbt, { psbtBase64: 'not-a-psbt' }))
    ).toStrictEqual({
      ok: false,
      reason: 'invalidPsbt'
    })
  })

  it('rejects a destination address of another network', () => {
    const psbt = buildClaimPsbt([{}], [claimOutput()])
    const mainnetAddress = bitcoinjs.address.fromOutputScript(
      DESTINATION_SCRIPT,
      bitcoinjs.networks.bitcoin
    )

    expect(
      verifyDraft(draftFor(psbt), { address: mainnetAddress })
    ).toStrictEqual({ ok: false, reason: 'invalidAddress' })
  })

  it('rejects a claim that pays another address', () => {
    const psbt = buildClaimPsbt(
      [{}],
      [{ script: OTHER_SCRIPT, value: EXIT_VALUE - BigInt(FEE_SATS) }]
    )

    expect(verifyDraft(draftFor(psbt))).toStrictEqual({
      ok: false,
      reason: 'unexpectedOutputs'
    })
  })

  it('rejects a claim with an extra output', () => {
    const psbt = buildClaimPsbt(
      [{}],
      [claimOutput(EXIT_VALUE - 1300n), { script: OTHER_SCRIPT, value: 1000n }]
    )

    expect(verifyDraft(draftFor(psbt))).toStrictEqual({
      ok: false,
      reason: 'unexpectedOutputs'
    })
  })

  it('rejects a claim that spends an exit nobody asked for', () => {
    const psbt = buildClaimPsbt(
      [{}, {}],
      [claimOutput(EXIT_VALUE * 2n - BigInt(FEE_SATS))]
    )
    const vtxoIds = [exitOutpoint(0), exitOutpoint(1)]

    expect(verifyDraft(draftFor(psbt, { vtxoIds }))).toStrictEqual({
      ok: false,
      reason: 'unexpectedInputs'
    })
  })

  it('rejects inputs that differ from the ids the wallet reported', () => {
    const psbt = buildClaimPsbt([{}], [claimOutput()])
    const requestedVtxoIds = [exitOutpoint(0), exitOutpoint(1)]

    expect(
      verifyDraft(draftFor(psbt, { vtxoIds: requestedVtxoIds }), {
        requestedVtxoIds
      })
    ).toStrictEqual({ ok: false, reason: 'unexpectedInputs' })
  })

  it('rejects an input without its prevout', () => {
    const psbt = buildClaimPsbt([{ attach: 'none' }], [claimOutput()])

    expect(verifyDraft(draftFor(psbt))).toStrictEqual({
      ok: false,
      reason: 'missingPrevout'
    })
  })

  it('rejects an input whose amount a signature would not commit to', () => {
    const psbt = buildClaimPsbt([{ script: OTHER_SCRIPT }], [claimOutput()])

    expect(verifyDraft(draftFor(psbt))).toStrictEqual({
      ok: false,
      reason: 'unverifiableInput'
    })
  })

  it('rejects a taproot input whose key is not on the curve', () => {
    const psbt = buildClaimPsbt(
      [{ script: Buffer.from(`5120${'55'.repeat(32)}`, 'hex') }],
      [claimOutput()]
    )

    expect(verifyDraft(draftFor(psbt))).toStrictEqual({
      ok: false,
      reason: 'unverifiableInput'
    })
  })

  it('rejects an input amount that differs from the exit amount', () => {
    const psbt = buildClaimPsbt([{}], [claimOutput()])

    expect(
      verifyDraft(draftFor(psbt), {
        knownAmounts: new Map([[exitOutpoint(0), Number(EXIT_VALUE) + 1]])
      })
    ).toStrictEqual({ ok: false, reason: 'inputAmountMismatch' })
  })

  it('rejects a fee that differs from the one the wallet reported', () => {
    const psbt = buildClaimPsbt([{}], [claimOutput()])

    expect(
      verifyDraft(draftFor(psbt, { feeSats: FEE_SATS - 1 }))
    ).toStrictEqual({ ok: false, reason: 'feeMismatch' })
  })

  it('rejects a claim whose output is dust', () => {
    const psbt = buildClaimPsbt([{ value: 600n }], [claimOutput(300n)])
    const vtxoIds = [exitOutpoint(0, 600n)]

    expect(
      verifyDraft(draftFor(psbt, { vtxoIds }), { requestedVtxoIds: vtxoIds })
    ).toStrictEqual({ ok: false, reason: 'belowDust' })
  })
})

describe('verifyArkExitClaimSignedTx', () => {
  function verifiedClaim(
    psbt: bitcoinjs.Psbt,
    feeSats = FEE_SATS
  ): VerifiedArkExitClaim {
    return {
      amountSats: Number(EXIT_VALUE) - feeSats,
      feeSats,
      inputAddresses: { [exitOutpoint(0)]: EXIT_ADDRESS },
      txid: bitcoinjs.Transaction.fromHex(signedHexFor(psbt)).getId(),
      vtxoIds: [exitOutpoint(0)]
    }
  }

  it('accepts the signed draft at a fee in line with the rate', () => {
    const psbt = buildClaimPsbt([{}], [claimOutput()])

    expect(
      verifyArkExitClaimSignedTx({
        claim: verifiedClaim(psbt),
        feeRateSatPerVb: 3,
        signedTxHex: signedHexFor(psbt)
      })
    ).toStrictEqual({ ok: true, txid: verifiedClaim(psbt).txid })
  })

  it('rejects an unreadable signed transaction', () => {
    const psbt = buildClaimPsbt([{}], [claimOutput()])

    expect(
      verifyArkExitClaimSignedTx({
        claim: verifiedClaim(psbt),
        feeRateSatPerVb: 3,
        signedTxHex: 'zz'
      })
    ).toStrictEqual({ ok: false, reason: 'invalidSignedTx' })
  })

  it('rejects a signed transaction other than the reviewed draft', () => {
    const psbt = buildClaimPsbt([{}], [claimOutput()])
    const other = buildClaimPsbt([{}], [claimOutput(EXIT_VALUE - 400n)])

    expect(
      verifyArkExitClaimSignedTx({
        claim: verifiedClaim(psbt),
        feeRateSatPerVb: 3,
        signedTxHex: signedHexFor(other)
      })
    ).toStrictEqual({ ok: false, reason: 'txidMismatch' })
  })

  it('rejects a transaction that is not signed', () => {
    const psbt = buildClaimPsbt([{}], [claimOutput()])
    const unsignedHex = bitcoinjs.Transaction.fromBuffer(
      psbt.data.globalMap.unsignedTx.toBuffer()
    ).toHex()

    expect(
      verifyArkExitClaimSignedTx({
        claim: verifiedClaim(psbt),
        feeRateSatPerVb: 3,
        signedTxHex: unsignedHex
      })
    ).toStrictEqual({ ok: false, reason: 'unsigned' })
  })

  it('rejects a fee far above the chosen rate', () => {
    const psbt = buildClaimPsbt([{}], [claimOutput()])

    expect(
      verifyArkExitClaimSignedTx({
        claim: verifiedClaim(psbt),
        feeRateSatPerVb: 1,
        signedTxHex: signedHexFor(psbt)
      })
    ).toStrictEqual({ ok: false, reason: 'feeTooHigh' })
  })
})

describe('matchesApprovedArkExitClaim', () => {
  const approved = {
    amountSats: 49_700,
    feeSats: 300,
    vtxoIds: [exitOutpoint(0), exitOutpoint(1)]
  }

  it('accepts the approved exits in any order', () => {
    expect(
      matchesApprovedArkExitClaim(
        { ...approved, vtxoIds: approved.vtxoIds.toReversed() },
        approved
      )
    ).toBe(true)
  })

  it('rejects a different amount, fee or set of exits', () => {
    expect(
      matchesApprovedArkExitClaim({ ...approved, amountSats: 49_000 }, approved)
    ).toBe(false)
    expect(
      matchesApprovedArkExitClaim({ ...approved, feeSats: 1000 }, approved)
    ).toBe(false)
    expect(
      matchesApprovedArkExitClaim(
        { ...approved, vtxoIds: [exitOutpoint(0)] },
        approved
      )
    ).toBe(false)
  })
})
