import * as bitcoinjs from 'bitcoinjs-lib'

import { ARK_BOARD_MAX_FUNDING_INPUTS } from '@/constants/ark'
import { type Key } from '@/types/models/Account'
import { type ArkBoardIntent } from '@/types/models/Ark'
import { type ScriptVersionType } from '@/types/models/Script'
import {
  buildArkBoardCosignPsbt,
  canAccountFundArkBoard,
  findArkBoardIntent,
  isArkBoardIntentFresh
} from '@/utils/arkBoardFunding'

const NETWORK = bitcoinjs.networks.testnet
const GENERATOR_X_ONLY =
  '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'

const P2WPKH_SCRIPT = Buffer.from(`0014${'11'.repeat(20)}`, 'hex')
const P2TR_SCRIPT = Buffer.from(`5120${GENERATOR_X_ONLY}`, 'hex')
const P2SH_SCRIPT = Buffer.from(`a914${'22'.repeat(20)}87`, 'hex')
const BOARD_SCRIPT = Buffer.from(`5120${GENERATOR_X_ONLY}`, 'hex')
const CHANGE_SCRIPT = Buffer.from(`0014${'33'.repeat(20)}`, 'hex')

const BOARD_ADDRESS = bitcoinjs.address.fromOutputScript(BOARD_SCRIPT, NETWORK)
const BOARD_AMOUNT = 50_000n
const PREVOUT_VALUE = 100_000n
const DUMMY_SIGNATURE = Buffer.alloc(64, 1)

type FundingInput = {
  prevoutScript: Buffer
  attach?: 'witnessUtxo' | 'nonWitnessUtxo' | 'none'
}

function buildPrevTx(script: Buffer, nonce: number): bitcoinjs.Transaction {
  const tx = new bitcoinjs.Transaction()
  tx.addInput(Buffer.alloc(32, 9), nonce)
  tx.addOutput(script, PREVOUT_VALUE)
  return tx
}

function buildFundingPsbt(
  inputs: FundingInput[],
  outputs: { script: Buffer; value: bigint }[]
): bitcoinjs.Psbt {
  const psbt = new bitcoinjs.Psbt({ network: NETWORK })
  for (const [
    index,
    { prevoutScript, attach = 'witnessUtxo' }
  ] of inputs.entries()) {
    const prevTx = buildPrevTx(prevoutScript, index)
    psbt.addInput({
      hash: prevTx.getHash(),
      index: 0,
      sequence: 0xff_ff_ff_fd - index,
      ...(attach === 'witnessUtxo' && {
        witnessUtxo: { script: prevoutScript, value: PREVOUT_VALUE }
      }),
      ...(attach === 'nonWitnessUtxo' && { nonWitnessUtxo: prevTx.toBuffer() })
    })
  }
  for (const output of outputs) {
    psbt.addOutput(output)
  }
  return psbt
}

function signedHexFor(
  psbt: bitcoinjs.Psbt,
  options: { scriptSig?: Buffer } = {}
): string {
  const tx = bitcoinjs.Transaction.fromBuffer(
    psbt.data.globalMap.unsignedTx.toBuffer()
  )
  for (const index of tx.ins.keys()) {
    tx.setWitness(index, [DUMMY_SIGNATURE])
  }
  if (options.scriptSig) {
    tx.setInputScript(0, options.scriptSig)
  }
  return tx.toHex()
}

const STANDARD_OUTPUTS = [
  { script: BOARD_SCRIPT, value: BOARD_AMOUNT },
  { script: CHANGE_SCRIPT, value: 40_000n }
]

describe('buildArkBoardCosignPsbt', () => {
  it('returns an unsigned PSBT with the same txid as the signed funding tx', () => {
    const psbt = buildFundingPsbt(
      [{ prevoutScript: P2WPKH_SCRIPT }, { prevoutScript: P2TR_SCRIPT }],
      STANDARD_OUTPUTS
    )
    const signedTxHex = signedHexFor(psbt)

    const result = buildArkBoardCosignPsbt({
      boardAddress: BOARD_ADDRESS,
      network: 'signet',
      psbtBase64: psbt.toBase64(),
      signedTxHex
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    const cosign = bitcoinjs.Psbt.fromBase64(result.psbtBase64)
    expect(result.txid).toBe(bitcoinjs.Transaction.fromHex(signedTxHex).getId())
    expect(result.amountSats).toBe(Number(BOARD_AMOUNT))
    expect(cosign.txInputs).toHaveLength(2)
    expect(cosign.txInputs[1].sequence).toBe(psbt.txInputs[1].sequence)
    expect(cosign.data.inputs[0].witnessUtxo?.value).toBe(PREVOUT_VALUE)
    expect(cosign.data.inputs[0].partialSig).toBeUndefined()
    expect(cosign.data.inputs[0].bip32Derivation).toBeUndefined()
  })

  it('derives the prevout from a non-witness utxo', () => {
    const psbt = buildFundingPsbt(
      [{ attach: 'nonWitnessUtxo', prevoutScript: P2WPKH_SCRIPT }],
      STANDARD_OUTPUTS
    )

    const result = buildArkBoardCosignPsbt({
      boardAddress: BOARD_ADDRESS,
      network: 'signet',
      psbtBase64: psbt.toBase64(),
      signedTxHex: signedHexFor(psbt)
    })

    expect(result.ok).toBe(true)
  })

  it('rejects inputs whose prevout is unknown', () => {
    const psbt = buildFundingPsbt(
      [{ attach: 'none', prevoutScript: P2WPKH_SCRIPT }],
      STANDARD_OUTPUTS
    )

    expect(
      buildArkBoardCosignPsbt({
        boardAddress: BOARD_ADDRESS,
        network: 'signet',
        psbtBase64: psbt.toBase64(),
        signedTxHex: signedHexFor(psbt)
      })
    ).toStrictEqual({ ok: false, reason: 'missingPrevout' })
  })

  it('rejects wrapped or legacy inputs because they change the txid', () => {
    const psbt = buildFundingPsbt(
      [{ prevoutScript: P2SH_SCRIPT }],
      STANDARD_OUTPUTS
    )

    expect(
      buildArkBoardCosignPsbt({
        boardAddress: BOARD_ADDRESS,
        network: 'signet',
        psbtBase64: psbt.toBase64(),
        signedTxHex: signedHexFor(psbt)
      })
    ).toStrictEqual({ ok: false, reason: 'nonNativeSegwitInput' })
  })

  it('rejects more inputs than the server cosigns', () => {
    const inputs = Array.from(
      { length: ARK_BOARD_MAX_FUNDING_INPUTS + 1 },
      () => ({ prevoutScript: P2WPKH_SCRIPT })
    )
    const psbt = buildFundingPsbt(inputs, STANDARD_OUTPUTS)

    expect(
      buildArkBoardCosignPsbt({
        boardAddress: BOARD_ADDRESS,
        network: 'signet',
        psbtBase64: psbt.toBase64(),
        signedTxHex: signedHexFor(psbt)
      })
    ).toStrictEqual({ ok: false, reason: 'tooManyInputs' })
  })

  it('rejects a funding tx without the board output', () => {
    const psbt = buildFundingPsbt(
      [{ prevoutScript: P2WPKH_SCRIPT }],
      [{ script: CHANGE_SCRIPT, value: 90_000n }]
    )

    expect(
      buildArkBoardCosignPsbt({
        boardAddress: BOARD_ADDRESS,
        network: 'signet',
        psbtBase64: psbt.toBase64(),
        signedTxHex: signedHexFor(psbt)
      })
    ).toStrictEqual({ ok: false, reason: 'missingBoardOutput' })
  })

  it('rejects a funding tx paying the board script twice', () => {
    const psbt = buildFundingPsbt(
      [{ prevoutScript: P2WPKH_SCRIPT }],
      [
        { script: BOARD_SCRIPT, value: 40_000n },
        { script: BOARD_SCRIPT, value: 40_000n }
      ]
    )

    expect(
      buildArkBoardCosignPsbt({
        boardAddress: BOARD_ADDRESS,
        network: 'signet',
        psbtBase64: psbt.toBase64(),
        signedTxHex: signedHexFor(psbt)
      })
    ).toStrictEqual({ ok: false, reason: 'duplicateBoardOutput' })
  })

  it('rejects a signed tx whose txid differs from the PSBT', () => {
    const psbt = buildFundingPsbt(
      [{ prevoutScript: P2WPKH_SCRIPT }],
      STANDARD_OUTPUTS
    )

    expect(
      buildArkBoardCosignPsbt({
        boardAddress: BOARD_ADDRESS,
        network: 'signet',
        psbtBase64: psbt.toBase64(),
        signedTxHex: signedHexFor(psbt, { scriptSig: Buffer.from('00', 'hex') })
      })
    ).toStrictEqual({ ok: false, reason: 'txidMismatch' })
  })

  it('rejects unreadable input', () => {
    const psbt = buildFundingPsbt(
      [{ prevoutScript: P2WPKH_SCRIPT }],
      STANDARD_OUTPUTS
    )
    const base = {
      boardAddress: BOARD_ADDRESS,
      network: 'signet' as const,
      psbtBase64: psbt.toBase64(),
      signedTxHex: signedHexFor(psbt)
    }

    expect(
      buildArkBoardCosignPsbt({ ...base, psbtBase64: 'not-a-psbt' })
    ).toStrictEqual({ ok: false, reason: 'invalidPsbt' })
    expect(
      buildArkBoardCosignPsbt({ ...base, signedTxHex: 'zz' })
    ).toStrictEqual({ ok: false, reason: 'invalidSignedTx' })
    expect(
      buildArkBoardCosignPsbt({ ...base, boardAddress: 'nope' })
    ).toStrictEqual({ ok: false, reason: 'invalidBoardAddress' })
  })
})

describe('findArkBoardIntent', () => {
  const intent: ArkBoardIntent = {
    address: BOARD_ADDRESS,
    arkAccountId: 'ark',
    expiryHeight: 2000,
    keypairIndex: 3,
    serverId: 'second'
  }
  const boardIntents = { [BOARD_ADDRESS]: intent }

  it('finds the intent of an output paying a board funding address', () => {
    expect(findArkBoardIntent(['a', BOARD_ADDRESS], boardIntents)).toBe(intent)
  })

  it('ignores outputs paying other addresses', () => {
    expect(findArkBoardIntent(['a', undefined], boardIntents)).toBeUndefined()
    expect(findArkBoardIntent([BOARD_ADDRESS], {})).toBeUndefined()
    expect(findArkBoardIntent(['constructor'], boardIntents)).toBeUndefined()
  })
})

function keyWith(scriptVersion: ScriptVersionType | undefined, index = 0): Key {
  return { index, iv: '', scriptVersion, secret: '' }
}

describe('canAccountFundArkBoard', () => {
  it('accepts native segwit single and multisig accounts on the Ark network', () => {
    expect(
      canAccountFundArkBoard(
        { keys: [keyWith('P2WPKH')], network: 'signet' },
        'signet'
      )
    ).toBe(true)
    expect(
      canAccountFundArkBoard(
        { keys: [keyWith('P2TR')], network: 'signet' },
        'signet'
      )
    ).toBe(true)
    expect(
      canAccountFundArkBoard(
        { keys: [keyWith('P2WSH'), keyWith('P2WSH', 1)], network: 'bitcoin' },
        'bitcoin'
      )
    ).toBe(true)
  })

  it('rejects accounts on another network', () => {
    expect(
      canAccountFundArkBoard(
        { keys: [keyWith('P2WPKH')], network: 'bitcoin' },
        'signet'
      )
    ).toBe(false)
  })

  const rejectedScriptVersions: (ScriptVersionType | undefined)[] = [
    'P2SH-P2WPKH',
    'P2PKH',
    'P2SH-P2WSH',
    undefined
  ]

  it.each(rejectedScriptVersions)('rejects %s keys', (scriptVersion) => {
    expect(
      canAccountFundArkBoard(
        { keys: [keyWith(scriptVersion)], network: 'signet' },
        'signet'
      )
    ).toBe(false)
  })

  it('rejects a multisig account when any key is not native segwit', () => {
    expect(
      canAccountFundArkBoard(
        {
          keys: [keyWith('P2WSH'), keyWith('P2SH-P2WSH', 1)],
          network: 'signet'
        },
        'signet'
      )
    ).toBe(false)
  })

  it('rejects an account without keys', () => {
    expect(
      canAccountFundArkBoard({ keys: [], network: 'signet' }, 'signet')
    ).toBe(false)
  })
})

describe('isArkBoardIntentFresh', () => {
  const vtxoLifetime = 1000

  it('accepts a funding address with most of its lifetime left', () => {
    expect(
      isArkBoardIntentFresh({
        expiryHeight: 2000,
        tipHeight: 1010,
        vtxoLifetime
      })
    ).toBe(true)
  })

  it('accepts a funding address exactly at the minimum remaining lifetime', () => {
    expect(
      isArkBoardIntentFresh({
        expiryHeight: 2000,
        tipHeight: 1500,
        vtxoLifetime
      })
    ).toBe(true)
  })

  it('rejects a stale or expired funding address', () => {
    expect(
      isArkBoardIntentFresh({
        expiryHeight: 2000,
        tipHeight: 1501,
        vtxoLifetime
      })
    ).toBe(false)
    expect(
      isArkBoardIntentFresh({
        expiryHeight: 2000,
        tipHeight: 2100,
        vtxoLifetime
      })
    ).toBe(false)
  })
})
