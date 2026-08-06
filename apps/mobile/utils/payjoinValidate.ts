import * as bitcoinjs from 'bitcoinjs-lib'

import {
  type PayjoinBip78Error,
  type PayjoinBip78ErrorCode
} from '@/types/payjoin'

type ValidateProposalResult = { ok: true } | { ok: false; reason: string }

function outpointKey(txid: string, vout: number): string {
  return `${txid}:${vout}`
}

/** Hermes may lack TypedArray.toReversed — use Buffer.reverse() instead. */
function txidFromPsbtInputHash(hash: Buffer | Uint8Array): string {
  // eslint-disable-next-line unicorn/no-array-reverse -- Hermes lacks TypedArray#toReversed
  return Buffer.from(hash).reverse().toString('hex')
}

/**
 * Minimal BIP78 proposal sanity checks when the native PDK validator is
 * unavailable. Full validation belongs in rust-payjoin; this guards the
 * TypeScript BIP78 HTTP path used in tests and as a fallback.
 */
function scriptHexOf(output: { script: Buffer | Uint8Array }): string {
  return Buffer.from(output.script).toString('hex')
}

/**
 * The intended payee outputs must survive the proposal unchanged in script and
 * never lose value — even when output substitution is enabled, the sender still
 * pays who it meant to. Anchored by index so a substituted attacker output at a
 * different position cannot masquerade as the payment.
 */
function checkPaymentOutputs(params: {
  original: bitcoinjs.Psbt
  proposal: bitcoinjs.Psbt
  paymentScriptsHex: string[]
  paymentAmountSats: number
  isScriptOwned: (scriptHex: string) => boolean
}): ValidateProposalResult {
  const paymentScripts = new Set(params.paymentScriptsHex)
  const paymentIndices = params.original.txOutputs
    .map((output, index) => ({ index, scriptHex: scriptHexOf(output) }))
    .filter((entry) => paymentScripts.has(entry.scriptHex))
    .map((entry) => entry.index)

  if (paymentIndices.length === 0) {
    // No known payee script to anchor (self-transfer or un-plumbed caller):
    // fall back to requiring the non-owned total to cover the requested amount.
    const paidToNonOwned = params.proposal.txOutputs.reduce(
      (sum, output) =>
        params.isScriptOwned(scriptHexOf(output)) ? sum : sum + output.value,
      0
    )
    if (paidToNonOwned > 0 && paidToNonOwned < params.paymentAmountSats) {
      return { ok: false, reason: 'receiver payment amount reduced' }
    }
    return { ok: true }
  }

  const singlePayment = paymentIndices.length === 1
  for (const index of paymentIndices) {
    const originalOut = params.original.txOutputs[index]!
    const proposalOut = params.proposal.txOutputs[index]
    if (!proposalOut || !originalOut.script.equals(proposalOut.script)) {
      return { ok: false, reason: 'payment output substituted or removed' }
    }
    if (proposalOut.value < originalOut.value) {
      return { ok: false, reason: 'receiver payment amount reduced' }
    }
    if (singlePayment && proposalOut.value < params.paymentAmountSats) {
      return { ok: false, reason: 'receiver payment amount reduced' }
    }
  }
  return { ok: true }
}

function sumNewInputValues(
  proposal: bitcoinjs.Psbt,
  originalOutpoints: Set<string>
): number {
  return proposal.txInputs.reduce((sum, input, index) => {
    const key = outpointKey(txidFromPsbtInputHash(input.hash), input.index)
    if (originalOutpoints.has(key)) {
      return sum
    }
    return sum + (proposal.data.inputs[index]?.witnessUtxo?.value ?? 0)
  }, 0)
}

/**
 * Sender-owned change may only shrink by what the receiver actually added to
 * the transaction (its new inputs minus its new outputs). Without this bound a
 * receiver could drain the sender's change to miner fees.
 */
function checkSenderChange(params: {
  original: bitcoinjs.Psbt
  proposal: bitcoinjs.Psbt
  originalOutpoints: Set<string>
  isScriptOwned: (scriptHex: string) => boolean
}): ValidateProposalResult {
  const originalScripts = new Set(params.original.txOutputs.map(scriptHexOf))
  const newInputSats = sumNewInputValues(
    params.proposal,
    params.originalOutpoints
  )
  const newOutputSats = params.proposal.txOutputs.reduce(
    (sum, output) =>
      originalScripts.has(scriptHexOf(output)) ? sum : sum + output.value,
    0
  )
  const maxChangeDecrease = Math.max(0, newInputSats - newOutputSats)
  const sameOutputCount =
    params.proposal.txOutputs.length === params.original.txOutputs.length

  for (let index = 0; index < params.original.txOutputs.length; index += 1) {
    const originalOut = params.original.txOutputs[index]!
    if (!params.isScriptOwned(scriptHexOf(originalOut))) {
      continue
    }
    const matched = params.proposal.txOutputs.find((output) =>
      output.script.equals(originalOut.script)
    )
    const fallback = sameOutputCount
      ? params.proposal.txOutputs[index]
      : undefined
    const proposalChange = (matched ?? fallback)?.value ?? 0
    if (originalOut.value - proposalChange > maxChangeDecrease) {
      return { ok: false, reason: 'sender change drained' }
    }
  }
  return { ok: true }
}

function validatePayjoinProposal(params: {
  originalPsbtBase64: string
  proposalPsbtBase64: string
  paymentAmountSats: number
  disableOutputSubstitution: boolean
  isScriptOwned: (scriptHex: string) => boolean
  paymentScriptsHex: string[]
}): ValidateProposalResult {
  let original: bitcoinjs.Psbt
  let proposal: bitcoinjs.Psbt
  try {
    original = bitcoinjs.Psbt.fromBase64(params.originalPsbtBase64)
    proposal = bitcoinjs.Psbt.fromBase64(params.proposalPsbtBase64)
  } catch {
    return { ok: false, reason: 'invalid psbt encoding' }
  }

  if (proposal.txInputs.length < original.txInputs.length) {
    return { ok: false, reason: 'proposal dropped original inputs' }
  }

  const originalOutpoints = new Set(
    original.txInputs.map((input) => {
      const txid = txidFromPsbtInputHash(input.hash)
      return outpointKey(txid, input.index)
    })
  )

  for (const key of originalOutpoints) {
    const found = proposal.txInputs.some((input) => {
      const txid = txidFromPsbtInputHash(input.hash)
      return outpointKey(txid, input.index) === key
    })
    if (!found) {
      return { ok: false, reason: 'proposal missing original input' }
    }
  }

  // Receiver must contribute at least one new input for a true payjoin.
  if (proposal.txInputs.length === original.txInputs.length) {
    return { ok: false, reason: 'proposal has no receiver input' }
  }

  if (params.disableOutputSubstitution) {
    if (proposal.txOutputs.length !== original.txOutputs.length) {
      return {
        ok: false,
        reason: 'output substitution disabled but outputs changed'
      }
    }
    for (let i = 0; i < original.txOutputs.length; i += 1) {
      const o = original.txOutputs[i]!
      const p = proposal.txOutputs[i]!
      // with pjos=0, BIP78 requires payment output script unchanged.
      if (!o.script.equals(p.script)) {
        return { ok: false, reason: 'payment output script substituted' }
      }
    }
  }

  const paymentCheck = checkPaymentOutputs({
    isScriptOwned: params.isScriptOwned,
    original,
    paymentAmountSats: params.paymentAmountSats,
    paymentScriptsHex: params.paymentScriptsHex,
    proposal
  })
  if (!paymentCheck.ok) {
    return paymentCheck
  }

  return checkSenderChange({
    isScriptOwned: params.isScriptOwned,
    original,
    originalOutpoints,
    proposal
  })
}

function parseBip78ErrorBody(body: string): PayjoinBip78Error {
  try {
    const json = JSON.parse(body) as {
      errorCode?: string
      message?: string
    }
    const code = (json.errorCode ?? 'unknown') as PayjoinBip78ErrorCode
    const allowed: PayjoinBip78ErrorCode[] = [
      'unavailable',
      'not-enough-money',
      'version-unsupported',
      'original-psbt-rejected',
      'unknown'
    ]
    return {
      errorCode: allowed.includes(code) ? code : 'unknown',
      message: json.message ?? body
    }
  } catch {
    return { errorCode: 'unknown', message: body }
  }
}

function isSelfTransfer(params: {
  outputScriptsHex: string[]
  isScriptOwned: (scriptHex: string) => boolean
}): boolean {
  if (params.outputScriptsHex.length === 0) {
    return false
  }
  return params.outputScriptsHex.every((scriptHex) =>
    params.isScriptOwned(scriptHex)
  )
}

export {
  isSelfTransfer,
  outpointKey,
  parseBip78ErrorBody,
  validatePayjoinProposal
}

export type { ValidateProposalResult }
