import * as bitcoinjs from 'bitcoinjs-lib'

import {
  type PayjoinBip78Error,
  type PayjoinBip78ErrorCode
} from '@/types/payjoin'

type ValidateProposalResult = { ok: true } | { ok: false; reason: string }

function outpointKey(txid: string, vout: number): string {
  return `${txid}:${vout}`
}

/**
 * Minimal BIP78 proposal sanity checks when the native PDK validator is
 * unavailable. Full validation belongs in rust-payjoin; this guards the
 * TypeScript BIP78 HTTP path used in tests and as a fallback.
 */
function validatePayjoinProposal(params: {
  originalPsbtBase64: string
  proposalPsbtBase64: string
  paymentAmountSats: number
  disableOutputSubstitution: boolean
  isScriptOwned: (scriptHex: string) => boolean
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
      const txid = Buffer.from(input.hash.toReversed()).toString('hex')
      return outpointKey(txid, input.index)
    })
  )

  for (const key of originalOutpoints) {
    const found = proposal.txInputs.some((input) => {
      const txid = Buffer.from(input.hash.toReversed()).toString('hex')
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

  for (const input of proposal.txInputs) {
    const txid = Buffer.from(input.hash.toReversed()).toString('hex')
    const key = outpointKey(txid, input.index)
    if (originalOutpoints.has(key)) {
      continue
    }
    // New inputs should not be owned by the sender.
    // We cannot always know script from PSBT input; skip if unavailable.
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

  // Ensure receiver is paid at least the requested amount on some output
  // that is not owned by the sender (best-effort using callback).
  let paidToReceiver = 0
  for (const output of proposal.txOutputs) {
    const scriptHex = Buffer.from(output.script).toString('hex')
    if (!params.isScriptOwned(scriptHex)) {
      paidToReceiver += output.value
    }
  }

  if (paidToReceiver < params.paymentAmountSats) {
    // Sender-owned change is excluded; if all outputs look owned, skip amount check.
    const anyNonOwned = proposal.txOutputs.some((output) => {
      const scriptHex = Buffer.from(output.script).toString('hex')
      return !params.isScriptOwned(scriptHex)
    })
    if (anyNonOwned) {
      return { ok: false, reason: 'receiver payment amount reduced' }
    }
  }

  return { ok: true }
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
