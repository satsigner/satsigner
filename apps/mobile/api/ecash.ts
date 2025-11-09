import {
  getDecodedToken,
  getEncodedTokenV4,
  Mint,
  type MintQuoteState,
  Wallet
} from '@cashu/cashu-ts'

import { useEcashStore } from '@/store/ecash'
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
const walletCache = new Map<string, Wallet>()

type KeysetResponse = {
  id: string
  unit?: string
  active?: boolean
}

/**
 * Helper function to get keysets from wallet (v3.0.0)
 */
export async function getKeysetsFromWallet(
  wallet: Wallet
): Promise<{ id: string; unit: 'sat'; active: boolean }[]> {
  const walletAny = wallet as {
    getKeysets?: () => Promise<KeysetResponse[]>
    mint?: { url?: string }
  }

  // v3.0.0: Try getKeysets() method first
  if (typeof walletAny.getKeysets === 'function') {
    const result = await walletAny.getKeysets()
    if (Array.isArray(result)) {
      return result
        .filter(
          (ks): ks is KeysetResponse =>
            ks && typeof ks === 'object' && typeof ks.id === 'string'
        )
        .map((ks) => ({
          id: ks.id,
          unit: 'sat' as const,
          active: ks.active !== false
        }))
    }
  }

  // Fallback: Fetch from mint API
  try {
    const mintUrl = walletAny.mint?.url
    if (mintUrl) {
      const response = await fetch(`${mintUrl}/keysets`)
      if (response.ok) {
        const keysetsData = (await response.json()) as
          | KeysetResponse[]
          | { keysets?: KeysetResponse[] }
        const keysets = Array.isArray(keysetsData)
          ? keysetsData
          : Array.isArray(keysetsData.keysets)
            ? keysetsData.keysets
            : []
        return keysets
          .filter(
            (ks): ks is KeysetResponse =>
              ks && typeof ks === 'object' && typeof ks.id === 'string'
          )
          .map((ks) => ({
            id: ks.id,
            unit: 'sat' as const,
            active: ks.active !== false
          }))
      }
    }
  } catch {
    // Fallback failed, return empty array
  }

  return []
}

export function getWallet(mintUrl: string): Wallet {
  if (!walletCache.has(mintUrl)) {
    const mint = new Mint(mintUrl)
    const wallet = new Wallet(mint)
    walletCache.set(mintUrl, wallet)
  }
  return walletCache.get(mintUrl)!
}

export async function connectToMint(mintUrl: string): Promise<EcashMint> {
  try {
    clearWalletCache(mintUrl)
    const wallet = getWallet(mintUrl)
    await wallet.loadMint()
    const mintInfo = await wallet.getMintInfo()
    const keysets = await getKeysetsFromWallet(wallet)

    return {
      url: mintUrl,
      name: mintInfo.name || `Mint ${mintUrl}`,
      isConnected: true,
      keysets: keysets.map((ks) => ({
        id: ks.id,
        unit: ks.unit,
        active: ks.active
      })),
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
    await wallet.loadMint()
    const quote = await wallet.createMintQuote(amount)

    // Connection successful, update status to true
    useEcashStore.getState().updateMintConnection(mintUrl, true)
    useEcashStore.getState().setError(undefined)

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
    await wallet.loadMint()
    const quoteStatus = await wallet.checkMintQuote(quoteId)

    // Connection successful, update status to true
    useEcashStore.getState().updateMintConnection(mintUrl, true)
    useEcashStore.getState().setError(undefined)

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
    await wallet.loadMint()
    const proofs = await wallet.mintProofs(amount, quoteId)

    // Connection successful, update status to true
    useEcashStore.getState().updateMintConnection(mintUrl, true)
    useEcashStore.getState().setError(undefined)

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
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to create melt quote: ${errorMessage}`)
  }
}

export async function meltProofs(
  mintUrl: string,
  quote: MeltQuote,
  proofs: EcashProof[],
  description?: string,
  originalInvoice?: string
): Promise<EcashMeltResult> {
  try {
    const wallet = getWallet(mintUrl)
    await wallet.loadMint()
    // v3.0.0: Need to recreate the quote object from the wallet
    // The new API expects the quote object returned by createMeltQuote
    // IMPORTANT: We need to use the original bolt11 invoice, not the quote ID
    const invoiceToUse = originalInvoice || quote.quote
    const meltQuote = await wallet.createMeltQuote(invoiceToUse)
    const result = await wallet.meltProofs(meltQuote, proofs)

    type MeltResult = {
      preimage?: string
      payment_preimage?: string
      change?: EcashProof[]
    }
    const meltResult = result as MeltResult

    // Connection successful, update status to true
    useEcashStore.getState().updateMintConnection(mintUrl, true)
    useEcashStore.getState().setError(undefined)

    return {
      paid: true, // If we get here without error, it was successful
      preimage: meltResult.preimage || meltResult.payment_preimage || undefined,
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

    const proofStates = await wallet.checkProofsStates(proofs)

    // Connection successful, update status to true
    useEcashStore.getState().updateMintConnection(mintUrl, true)
    useEcashStore.getState().setError(undefined)

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
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    const errorName = (error as { name?: string })?.name

    if (
      errorName === 'NetworkError' ||
      errorMsg.includes('Network request failed')
    ) {
      useEcashStore
        .getState()
        .setError('Network request failed. Please check your connection.')
      useEcashStore.getState().updateMintConnection(mintUrl, false)
    }

    throw new Error(`Failed to validate proofs: ${errorMsg}`)
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

    // Connection successful, update status to true
    useEcashStore.getState().updateMintConnection(mintUrl, true)
    useEcashStore.getState().setError(undefined)

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
    await wallet.loadMint()

    // Decode token to get mint URL and validate
    const decodedToken = getDecodedToken(token)
    if (decodedToken.mint !== mintUrl) {
      throw new Error('Token mint URL does not match current mint')
    }

    const proofs = await wallet.receive(token)
    const totalAmount = proofs.reduce((sum, proof) => sum + proof.amount, 0)

    // Connection successful, update status to true
    useEcashStore.getState().updateMintConnection(mintUrl, true)
    useEcashStore.getState().setError(undefined)

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

    const wallet = getWallet(mintUrl)
    if (!wallet) {
      return { isValid: false, details: 'Wallet not found for mint' }
    }

    const proofs = decodedToken.proofs || []
    if (proofs.length === 0) {
      return { isValid: false, details: 'No proofs found in token' }
    }

    const proofStates = await wallet.checkProofsStates(proofs)

    // Connection successful, update status to true
    useEcashStore.getState().updateMintConnection(mintUrl, true)
    useEcashStore.getState().setError(undefined)

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
    let httpStatus: number | undefined
    let httpStatusText: string | undefined
    let errorResponse: unknown
    if (error && typeof error === 'object') {
      const errorAny = error as {
        status?: number
        statusCode?: number
        response?: { status?: number; statusText?: string }
        cause?: { status?: number; statusCode?: number }
      }

      httpStatus =
        errorAny.status ||
        errorAny.statusCode ||
        errorAny.response?.status ||
        errorAny.cause?.status ||
        errorAny.cause?.statusCode
      httpStatusText = errorAny.response?.statusText
      errorResponse = errorAny.response
    }

    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    const errorName = (error as { name?: string })?.name
    if (!httpStatus && errorMsg) {
      const statusMatch = errorMsg.match(
        /\b(429|403|401|404|500|502|503|504)\b/
      )
      if (statusMatch) {
        httpStatus = parseInt(statusMatch[1], 10)
      }
    }

    const isRateLimitError =
      errorMsg.toLowerCase().includes('rate limit') ||
      errorMsg.toLowerCase().includes('too many requests') ||
      errorMsg.toLowerCase().includes('429')

    // Note: React Native's fetch doesn't expose HTTP status codes in NetworkError
    // The @cashu/cashu-ts library uses fetch internally, so we can't definitively
    // detect rate limiting (429) or blocked connections (403) from generic network errors
    if (httpStatus) {
      const storeErrorMessage =
        httpStatus === 429
          ? 'Connection rate limited. Please wait before retrying.'
          : httpStatus === 403
            ? 'Connection blocked or forbidden. Please check mint access.'
            : `HTTP ${httpStatus}: ${errorMsg}`

      useEcashStore.getState().setError(storeErrorMessage)
      useEcashStore.getState().updateMintConnection(mintUrl, false)
    } else if (isRateLimitError) {
      useEcashStore
        .getState()
        .setError('Connection rate limited. Please wait before retrying.')
      useEcashStore.getState().updateMintConnection(mintUrl, false)
    } else if (
      errorName === 'NetworkError' ||
      errorMsg.includes('Network request failed')
    ) {
      useEcashStore
        .getState()
        .setError('Network request failed. Please check your connection.')
      useEcashStore.getState().updateMintConnection(mintUrl, false)
    }

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
