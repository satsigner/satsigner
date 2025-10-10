import {
  CashuMint,
  CashuWallet,
  getDecodedToken,
  getEncodedTokenV4,
  type MintQuoteState
} from '@cashu/cashu-ts'

import {
  type EcashMeltResult,
  type EcashMint,
  type EcashMintResult,
  type EcashProof,
  type EcashReceiveResult,
  type EcashSendResult,
  type MeltQuote,
  type MintQuote
} from '@/types/models/Ecash'

// Cache for wallet instances
const walletCache = new Map<string, CashuWallet>()

function getWallet(mintUrl: string): CashuWallet {
  if (!walletCache.has(mintUrl)) {
    const mint = new CashuMint(mintUrl)
    const wallet = new CashuWallet(mint)
    walletCache.set(mintUrl, wallet)
  }
  return walletCache.get(mintUrl)!
}

export async function connectToMint(mintUrl: string): Promise<EcashMint> {
  try {
    const wallet = getWallet(mintUrl)
    await wallet.loadMint()

    const mintInfo = await wallet.getMintInfo()

    return {
      url: mintUrl,
      name: mintInfo.name || `Mint ${mintUrl}`,
      isConnected: true,
      keysets: [], // Will be populated from wallet keysets
      balance: 0, // Will be calculated from proofs
      lastSync: new Date().toISOString()
    }
  } catch (error) {
    throw new Error(
      `Failed to connect to mint: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function createMintQuote(
  mintUrl: string,
  amount: number
): Promise<MintQuote> {
  try {
    const wallet = getWallet(mintUrl)
    const quote = await wallet.createMintQuote(amount)

    return {
      quote: quote.quote,
      request: quote.request,
      expiry: quote.expiry,
      paid: false
    }
  } catch (error) {
    throw new Error(
      `Failed to create mint quote: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function checkMintQuote(
  mintUrl: string,
  quoteId: string
): Promise<MintQuoteState> {
  try {
    const wallet = getWallet(mintUrl)
    const quoteStatus = await wallet.checkMintQuote(quoteId)
    return quoteStatus.state
  } catch (error) {
    throw new Error(
      `Failed to check mint quote: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function mintProofs(
  mintUrl: string,
  amount: number,
  quoteId: string
): Promise<EcashMintResult> {
  try {
    const wallet = getWallet(mintUrl)
    const proofs = await wallet.mintProofs(amount, quoteId)

    return {
      proofs,
      totalAmount: amount
    }
  } catch (error) {
    throw new Error(
      `Failed to mint proofs: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function createMeltQuote(
  mintUrl: string,
  invoice: string
): Promise<MeltQuote> {
  try {
    const wallet = getWallet(mintUrl)
    const quote = await wallet.createMeltQuote(invoice)

    return {
      quote: quote.quote,
      amount: quote.amount,
      fee_reserve: quote.fee_reserve,
      paid: false,
      expiry: quote.expiry
    }
  } catch (error) {
    throw new Error(
      `Failed to create melt quote: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function meltProofs(
  mintUrl: string,
  quote: MeltQuote,
  proofs: EcashProof[]
): Promise<EcashMeltResult> {
  try {
    const wallet = getWallet(mintUrl)
    const result = await wallet.meltProofs(quote as any, proofs)

    return {
      paid: true, // If we get here without error, it was successful
      preimage: undefined, // Will be available in the result
      change: result.change
    }
  } catch (error) {
    throw new Error(
      `Failed to melt proofs: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function validateProofs(
  mintUrl: string,
  proofs: EcashProof[]
): Promise<{ validProofs: EcashProof[]; spentProofs: EcashProof[] }> {
  try {
    const wallet = getWallet(mintUrl)
    await wallet.loadMint()

    // Check the state of all proofs
    const proofStates = await wallet.checkProofsStates(proofs)

    const validProofs: EcashProof[] = []
    const spentProofs: EcashProof[] = []

    proofStates.forEach((state, index) => {
      if (state.state === 'UNSPENT' || state.state === 'PENDING') {
        validProofs.push(proofs[index])
      } else if (state.state === 'SPENT') {
        spentProofs.push(proofs[index])
      }
    })

    return { validProofs, spentProofs }
  } catch (error) {
    throw new Error(
      `Failed to validate proofs: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function sendEcash(
  mintUrl: string,
  amount: number,
  proofs: EcashProof[],
  memo?: string
): Promise<EcashSendResult> {
  try {
    if (!proofs || proofs.length === 0) {
      throw new Error('No proofs available to send')
    }

    // Validate proofs before attempting to send
    const { validProofs, spentProofs } = await validateProofs(mintUrl, proofs)

    if (spentProofs.length > 0) {
      throw new Error(
        `Token already spent. ${spentProofs.length} proof(s) have been spent.`
      )
    }

    if (validProofs.length === 0) {
      throw new Error('No valid proofs available to send')
    }

    const totalProofAmount = validProofs.reduce(
      (sum, proof) => sum + proof.amount,
      0
    )

    if (totalProofAmount < amount) {
      throw new Error(
        `Insufficient balance. Available: ${totalProofAmount} sats, Required: ${amount} sats`
      )
    }

    const wallet = getWallet(mintUrl)
    // Ensure wallet is loaded with mint keys
    await wallet.loadMint()
    const { keep, send } = await wallet.send(amount, validProofs, {
      includeFees: true
    })

    const token = getEncodedTokenV4({
      mint: mintUrl,
      proofs: send,
      unit: 'sat',
      memo
    })

    return {
      token,
      keep,
      send
    }
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function receiveEcash(
  mintUrl: string,
  token: string
): Promise<EcashReceiveResult> {
  try {
    const wallet = getWallet(mintUrl)

    // Decode token to get mint URL and validate
    const decodedToken = getDecodedToken(token)
    if (decodedToken.mint !== mintUrl) {
      throw new Error('Token mint URL does not match current mint')
    }

    const proofs = await wallet.receive(token)
    const totalAmount = proofs.reduce((sum, proof) => sum + proof.amount, 0)

    return {
      proofs,
      totalAmount,
      memo: decodedToken.memo
    }
  } catch (error) {
    throw new Error(
      `Failed to receive ecash: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function getMintBalance(
  mintUrl: string,
  proofs: EcashProof[]
): Promise<number> {
  try {
    // Filter proofs for this specific mint
    const mintProofs = proofs.filter(() => {
      // This would need to be enhanced to properly identify mint-specific proofs
      // For now, we'll assume all proofs belong to the current mint
      return true
    })

    return mintProofs.reduce((sum, proof) => sum + proof.amount, 0)
  } catch (error) {
    throw new Error(
      `Failed to calculate mint balance: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function validateEcashToken(
  token: string,
  mintUrl: string
): Promise<{ isValid: boolean; isSpent?: boolean; details?: string }> {
  try {
    const decodedToken = getDecodedToken(token)

    // Get wallet for this mint
    const wallet = getWallet(mintUrl)
    if (!wallet) {
      return { isValid: false, details: 'Wallet not found for mint' }
    }

    // Extract proofs from the token
    const proofs = decodedToken.proofs || []
    if (proofs.length === 0) {
      return { isValid: false, details: 'No proofs found in token' }
    }

    // Check the state of proofs using checkProofsStates
    const proofStates = await wallet.checkProofsStates(proofs)

    // Analyze the results
    const spentProofs = proofStates.filter((state) => state.state === 'SPENT')
    const unspentProofs = proofStates.filter(
      (state) => state.state === 'UNSPENT'
    )
    const pendingProofs = proofStates.filter(
      (state) => state.state === 'PENDING'
    )

    if (spentProofs.length === proofs.length) {
      return {
        isValid: true,
        isSpent: true,
        details: 'All proofs have been spent'
      }
    } else if (unspentProofs.length === proofs.length) {
      return {
        isValid: true,
        isSpent: false,
        details: 'All proofs are unspent'
      }
    } else if (pendingProofs.length > 0) {
      return {
        isValid: true,
        isSpent: false,
        details: `${pendingProofs.length} proof(s) are pending`
      }
    } else {
      return {
        isValid: true,
        isSpent: false,
        details: `Mixed state: ${spentProofs.length} spent, ${unspentProofs.length} unspent`
      }
    }
  } catch (error) {
    return {
      isValid: false,
      details: `Failed to check proof states: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

export function clearWalletCache(mintUrl?: string): void {
  if (mintUrl) {
    walletCache.delete(mintUrl)
  } else {
    walletCache.clear()
  }
}
