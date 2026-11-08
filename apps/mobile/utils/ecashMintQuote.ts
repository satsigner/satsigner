import type { MintQuoteState } from '@/types/models/Ecash'
import { assertNever } from '@/utils/assertNever'

/**
 * What a poller does with a mint quote state. `ISSUED` means the proofs were
 * already minted, here or elsewhere: minting again only gets an error back.
 */
type MintQuotePollStep = 'wait' | 'mint' | 'issued' | 'failed'

function toMintQuotePollStep(state: MintQuoteState): MintQuotePollStep {
  switch (state) {
    case 'PENDING':
    case 'UNPAID': {
      return 'wait'
    }
    case 'PAID': {
      return 'mint'
    }
    case 'ISSUED': {
      return 'issued'
    }
    case 'EXPIRED':
    case 'CANCELLED': {
      return 'failed'
    }
    default: {
      return assertNever(state)
    }
  }
}

function isMintQuoteSettled(state: MintQuoteState): boolean {
  return toMintQuotePollStep(state) !== 'wait'
}

export { isMintQuoteSettled, type MintQuotePollStep, toMintQuotePollStep }
