import {
  getDecodedToken,
  getEncodedTokenV4,
  Mint,
  type MintQuoteState,
  Wallet
} from '@cashu/cashu-ts'

import type {
  EcashMeltResult,
  EcashMint,
  EcashMintResult,
  EcashProof,
  EcashReceiveResult,
  EcashSendResult,
  MeltQuote,
  MintQuote
} from '@/types/models/Ecash'

// Cache for wallet instances
const walletCache = new Map<string, Wallet>()

type KeysetResponse = {
  id: string
  unit?: string
  active?: boolean
}

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
  clearWalletCache(mintUrl)
  const wallet = getWallet(mintUrl)
  await wallet.loadMint()
  const mintInfo = wallet.getMintInfo()
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
}

export async function createMintQuote(
  mintUrl: string,
  amount: number
): Promise<MintQuote> {
  const wallet = getWallet(mintUrl)
  await wallet.loadMint()
  const quote = await wallet.createMintQuote(amount)
  return {
    quote: quote.quote,
    request: quote.request,
    expiry: quote.expiry,
    paid: false
  }
}

export async function checkMintQuote(
  mintUrl: string,
  quoteId: string
): Promise<MintQuoteState> {
  const wallet = getWallet(mintUrl)
  await wallet.loadMint()
  const quoteStatus = await wallet.checkMintQuote(quoteId)
  return quoteStatus.state
}

export async function mintProofs(
  mintUrl: string,
  amount: number,
  quoteId: string
): Promise<EcashMintResult> {
  const wallet = getWallet(mintUrl)
  await wallet.loadMint()
  const proofs = await wallet.mintProofs(amount, quoteId)
  return {
    proofs,
    totalAmount: amount
  }
}

export async function createMeltQuote(
  mintUrl: string,
  invoice: string
): Promise<MeltQuote> {
  const wallet = getWallet(mintUrl)
  const quote = await wallet.createMeltQuote(invoice)
  return {
    quote: quote.quote,
    amount: quote.amount,
    fee_reserve: quote.fee_reserve,
    paid: false,
    expiry: quote.expiry
  }
}

export async function meltProofs(
  mintUrl: string,
  quote: MeltQuote,
  proofs: EcashProof[],
  _description?: string,
  originalInvoice?: string
): Promise<EcashMeltResult> {
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

  return {
    paid: true, // If we get here without error, it was successful
    preimage: meltResult.preimage || meltResult.payment_preimage || undefined,
    change: result.change
  }
}

export async function validateProofs(
  mintUrl: string,
  proofs: EcashProof[]
): Promise<{ validProofs: EcashProof[]; spentProofs: EcashProof[] }> {
  const wallet = getWallet(mintUrl)
  await wallet.loadMint()

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
}

export async function sendEcash(
  mintUrl: string,
  amount: number,
  proofs: EcashProof[],
  memo?: string
): Promise<EcashSendResult> {
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
}

export async function receiveEcash(
  mintUrl: string,
  token: string
): Promise<EcashReceiveResult> {
  const wallet = getWallet(mintUrl)
  await wallet.loadMint()

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
}

export async function getMintBalance(
  _mintUrl: string,
  proofs: EcashProof[]
): Promise<number> {
  return proofs.reduce((sum, proof) => sum + proof.amount, 0)
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
  } catch {
    return {
      isValid: false,
      details: `Failed to check proof states,.`
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
