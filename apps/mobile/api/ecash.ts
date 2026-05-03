import {
  CheckStateEnum,
  getDecodedToken,
  getEncodedTokenV3,
  getEncodedTokenV4,
  Mint,
  type MintQuoteState,
  type Proof,
  Wallet
} from '@cashu/cashu-ts'

import type {
  CounterReservedEvent,
  EcashMeltResult,
  EcashMint,
  EcashMintResult,
  EcashProof,
  EcashReceiveResult,
  EcashSendResult,
  MeltQuote,
  MintQuote,
  WalletOptions
} from '@/types/models/Ecash'

type KeysetResponse = {
  id: string
  unit?: string
  active?: boolean
}

type WalletInternals = {
  mint?: {
    getKeySets?: () => Promise<{ keysets?: KeysetResponse[] }>
    _mintUrl?: string
    url?: string
  }
  _keyChain?: {
    keysets?: Record<string, { id: string; unit?: string; active?: boolean }>
  }
}

const walletCache = new Map<string, Wallet>()

function walletCacheKey(accountId: string, mintUrl: string): string {
  return `${accountId}:${mintUrl}`
}

async function getKeysetsFromWallet(
  wallet: Wallet
): Promise<{ id: string; unit: string; active: boolean }[]> {
  const walletInternals = wallet as unknown as WalletInternals

  // Method 1: Use mint.getKeySets() (the actual cashu-ts v3 API)
  if (typeof walletInternals.mint?.getKeySets === 'function') {
    try {
      const result = await walletInternals.mint.getKeySets()
      if (result.keysets && Array.isArray(result.keysets)) {
        return result.keysets
          .filter(
            (ks): ks is KeysetResponse =>
              ks && typeof ks === 'object' && typeof ks.id === 'string'
          )
          .map((ks) => ({
            active: ks.active !== false,
            id: ks.id,
            unit: ks.unit ?? 'sat'
          }))
      }
    } catch {
      // Fall through to next method
    }
  }

  // Method 2: Read from _keyChain.keysets (in-memory after loadMint)
  if (walletInternals._keyChain?.keysets) {
    const keysets = Object.values(walletInternals._keyChain.keysets)
    if (keysets.length > 0) {
      return keysets.map((ks) => ({
        active: ks.active !== false,
        id: ks.id,
        unit: ks.unit ?? 'sat'
      }))
    }
  }

  // Method 3: Direct HTTP fallback
  const mintUrl = walletInternals.mint?._mintUrl ?? walletInternals.mint?.url
  if (mintUrl) {
    try {
      const response = await fetch(`${mintUrl}/v1/keysets`)
      if (response.ok) {
        const data = (await response.json()) as { keysets?: KeysetResponse[] }
        const keysets = data.keysets ?? []
        return keysets
          .filter(
            (ks): ks is KeysetResponse =>
              ks && typeof ks === 'object' && typeof ks.id === 'string'
          )
          .map((ks) => ({
            active: ks.active !== false,
            id: ks.id,
            unit: ks.unit ?? 'sat'
          }))
      }
    } catch {
      // Fall through
    }
  }

  return []
}

function getWallet(
  accountId: string,
  mintUrl: string,
  options?: WalletOptions
): Wallet {
  const cacheKey = walletCacheKey(accountId, mintUrl)

  if (!walletCache.has(cacheKey)) {
    const mint = new Mint(mintUrl)
    const walletOpts: Record<string, unknown> = { unit: 'sat' }

    if (options?.bip39seed) {
      walletOpts.bip39seed = options.bip39seed
      walletOpts.secretsPolicy = 'deterministic'
    }

    if (options?.counterInit) {
      walletOpts.counterInit = options.counterInit
    }

    const wallet = new Wallet(mint, walletOpts)

    if (options?.bip39seed && options.onCounterReserved) {
      const walletWithEvents = wallet as unknown as {
        on?: {
          countersReserved?: (
            cb: (event: CounterReservedEvent) => void
          ) => () => void
        }
      }
      walletWithEvents.on?.countersReserved?.(options.onCounterReserved)
    }

    walletCache.set(cacheKey, wallet)
  }
  return walletCache.get(cacheKey)!
}

export async function connectToMint(mintUrl: string): Promise<EcashMint> {
  const tempMint = new Mint(mintUrl)
  const tempWallet = new Wallet(tempMint)
  await tempWallet.loadMint()
  const mintInfo = tempWallet.getMintInfo()
  const keysets = await getKeysetsFromWallet(tempWallet)
  return {
    balance: 0,
    isConnected: true,
    keysets: keysets
      .filter((ks) => ks.unit === 'sat')
      .map((ks) => ({
        active: ks.active,
        id: ks.id,
        unit: 'sat' as const
      })),
    lastSync: new Date().toISOString(),
    name: mintInfo.name || `Mint ${mintUrl}`,
    url: mintUrl
  }
}

export async function createMintQuote(
  accountId: string,
  mintUrl: string,
  amount: number,
  options?: WalletOptions
): Promise<MintQuote> {
  const wallet = getWallet(accountId, mintUrl, options)
  await wallet.loadMint()
  const quote = await wallet.createMintQuote(amount)
  return {
    expiry: quote.expiry,
    mintUrl,
    paid: false,
    quote: quote.quote,
    request: quote.request
  }
}

export async function checkMintQuote(
  accountId: string,
  mintUrl: string,
  quoteId: string,
  options?: WalletOptions
): Promise<MintQuoteState> {
  const wallet = getWallet(accountId, mintUrl, options)
  await wallet.loadMint()
  const quoteStatus = await wallet.checkMintQuote(quoteId)
  return quoteStatus.state
}

export async function mintProofs(
  accountId: string,
  mintUrl: string,
  amount: number,
  quoteId: string,
  options?: WalletOptions
): Promise<EcashMintResult> {
  const wallet = getWallet(accountId, mintUrl, options)
  await wallet.loadMint()
  const proofs = await wallet.mintProofs(amount, quoteId)
  return {
    proofs: proofs.map((p) => ({ ...p, mintUrl })),
    totalAmount: amount
  }
}

export async function createMeltQuote(
  accountId: string,
  mintUrl: string,
  invoice: string,
  options?: WalletOptions
): Promise<MeltQuote> {
  const wallet = getWallet(accountId, mintUrl, options)
  const quote = await wallet.createMeltQuote(invoice)
  return {
    amount: quote.amount,
    expiry: quote.expiry,
    fee_reserve: quote.fee_reserve,
    mintUrl,
    paid: false,
    quote: quote.quote
  }
}

export class EcashSpentProofsError extends Error {
  readonly spentProofSecrets: string[]

  constructor(spentProofSecrets: string[]) {
    super(
      `Token already spent. ${spentProofSecrets.length} proof(s) have been spent.`
    )
    this.name = 'EcashSpentProofsError'
    this.spentProofSecrets = spentProofSecrets
  }
}

export async function meltProofs(
  accountId: string,
  mintUrl: string,
  quote: MeltQuote,
  proofs: EcashProof[],
  _description?: string,
  _originalInvoice?: string,
  options?: WalletOptions
): Promise<EcashMeltResult> {
  const wallet = getWallet(accountId, mintUrl, options)
  await wallet.loadMint()

  const { validProofs, spentProofs } = await validateProofs(
    accountId,
    mintUrl,
    proofs,
    options
  )
  if (validProofs.length === 0) {
    throw new Error('No valid proofs available to melt')
  }

  const cashuQuote = {
    amount: quote.amount,
    expiry: quote.expiry,
    fee_reserve: quote.fee_reserve,
    payment_preimage: null,
    quote: quote.quote,
    request: '',
    state: 'UNPAID' as const,
    unit: 'sat'
  }
  const result = await wallet.meltProofs(
    cashuQuote as Parameters<typeof wallet.meltProofs>[0],
    validProofs
  )

  const meltResult = result as unknown as {
    preimage?: string
    payment_preimage?: string
  }

  return {
    change: result.change?.map((p) => ({ ...p, mintUrl })),
    paid: true,
    preimage: meltResult.preimage || meltResult.payment_preimage || undefined,
    spentProofs: spentProofs.length > 0 ? spentProofs : undefined
  }
}

async function validateProofs(
  accountId: string,
  mintUrl: string,
  proofs: EcashProof[],
  options?: WalletOptions
): Promise<{ validProofs: EcashProof[]; spentProofs: EcashProof[] }> {
  const wallet = getWallet(accountId, mintUrl, options)
  await wallet.loadMint()

  const proofStates = await wallet.checkProofsStates(proofs)

  const validProofs: EcashProof[] = []
  const spentProofs: EcashProof[] = []

  for (const [index, state] of proofStates.entries()) {
    if (state.state === 'UNSPENT' || state.state === 'PENDING') {
      validProofs.push(proofs[index])
    } else if (state.state === 'SPENT') {
      spentProofs.push(proofs[index])
    }
  }

  return { spentProofs, validProofs }
}

export async function sendEcash(
  accountId: string,
  mintUrl: string,
  amount: number,
  proofs: EcashProof[],
  memo?: string,
  options?: WalletOptions
): Promise<EcashSendResult> {
  if (!proofs || proofs.length === 0) {
    throw new Error('No proofs available to send')
  }

  const { validProofs, spentProofs } = await validateProofs(
    accountId,
    mintUrl,
    proofs,
    options
  )

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

  const wallet = getWallet(accountId, mintUrl, options)
  await wallet.loadMint()

  const { keep, send } = await wallet.send(amount, validProofs, {
    includeFees: true
  })

  const tokenPayload = { memo, mint: mintUrl, proofs: send, unit: 'sat' }
  const token = getEncodedTokenV4(tokenPayload)
  const tokenV3 = getEncodedTokenV3(tokenPayload)

  return {
    keep: keep.map((p) => ({ ...p, mintUrl })),
    send: send.map((p) => ({ ...p, mintUrl })),
    token,
    tokenV3
  }
}

export function encodeProofsAsToken(
  mintUrl: string,
  proofs: EcashProof[],
  memo?: string,
  tokenVersion: 'v3' | 'v4' = 'v4'
): string {
  const tokenPayload = { memo, mint: mintUrl, proofs, unit: 'sat' }
  return tokenVersion === 'v3'
    ? getEncodedTokenV3(tokenPayload)
    : getEncodedTokenV4(tokenPayload)
}

export async function receiveEcash(
  accountId: string,
  mintUrl: string,
  token: string,
  options?: WalletOptions
): Promise<EcashReceiveResult> {
  const wallet = getWallet(accountId, mintUrl, options)
  await wallet.loadMint()

  const decodedToken = getDecodedToken(token)
  if (decodedToken.mint !== mintUrl) {
    throw new Error('Token mint URL does not match current mint')
  }

  const proofs = await wallet.receive(token)
  const totalAmount = proofs.reduce((sum, proof) => sum + proof.amount, 0)

  return {
    memo: decodedToken.memo,
    proofs: proofs.map((p) => ({ ...p, mintUrl })),
    totalAmount
  }
}

export function getMintBalance(mintUrl: string, proofs: EcashProof[]): number {
  return proofs
    .filter((p) => p.mintUrl === mintUrl)
    .reduce((sum, proof) => sum + proof.amount, 0)
}

export async function validateEcashToken(
  token: string,
  accountId: string,
  mintUrl: string,
  options?: WalletOptions
): Promise<{ isValid: boolean; isSpent?: boolean; details?: string }> {
  try {
    const decodedToken = getDecodedToken(token)

    const wallet = getWallet(accountId, mintUrl, options)
    if (!wallet) {
      return { details: 'Wallet not found for mint', isValid: false }
    }

    const proofs = decodedToken.proofs || []
    if (proofs.length === 0) {
      return { details: 'No proofs found in token', isValid: false }
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
        details: 'All proofs have been spent',
        isSpent: true,
        isValid: true
      }
    } else if (unspentProofs.length === proofs.length) {
      return {
        details: 'All proofs are unspent',
        isSpent: false,
        isValid: true
      }
    } else if (pendingProofs.length > 0) {
      return {
        details: `${pendingProofs.length} proof(s) are pending`,
        isSpent: false,
        isValid: true
      }
    }
    return {
      details: `Mixed state: ${spentProofs.length} spent, ${unspentProofs.length} unspent`,
      isSpent: false,
      isValid: true
    }
  } catch {
    return {
      details: 'Failed to check proof states.',
      isValid: false
    }
  }
}

const RESTORE_BATCH_SIZE = 25
const RESTORE_TIMEOUT_MS = 15000
const MAX_EMPTY_BATCHES = 2

export async function restoreProofsFromSeed(
  accountId: string,
  mintUrl: string,
  seed: Uint8Array,
  counterInit?: Record<string, number>
): Promise<{
  proofs: EcashProof[]
  lastCounter?: number
}> {
  clearWalletCache(accountId, mintUrl)

  const wallet = getWallet(accountId, mintUrl, {
    bip39seed: seed,
    counterInit
  })

  await wallet.loadMint()

  const mintKeysets = await getKeysetsFromWallet(wallet)

  const satKeysets = mintKeysets.filter((ks) => ks.unit === 'sat')
  const sortedKeysets = [
    ...satKeysets.filter((ks) => ks.active),
    ...satKeysets.filter((ks) => !ks.active)
  ]

  const allProofs: Proof[] = []
  let lastCounter: number | undefined

  for (const keyset of sortedKeysets) {
    try {
      await loadKeysForKeyset(wallet, keyset.id)

      const result = await withTimeout(
        wallet.restore(0, RESTORE_BATCH_SIZE, { keysetId: keyset.id }),
        RESTORE_TIMEOUT_MS
      )

      if (result.proofs.length > 0) {
        allProofs.push(...result.proofs)
        if (
          result.lastCounterWithSignature !== undefined &&
          (lastCounter === undefined ||
            result.lastCounterWithSignature > lastCounter)
        ) {
          lastCounter = result.lastCounterWithSignature
        }

        let nextCounter = RESTORE_BATCH_SIZE
        let emptyBatches = 0
        while (emptyBatches < MAX_EMPTY_BATCHES) {
          const contResult = await withTimeout(
            wallet.restore(nextCounter, RESTORE_BATCH_SIZE, {
              keysetId: keyset.id
            }),
            RESTORE_TIMEOUT_MS
          )
          if (contResult.proofs.length > 0) {
            allProofs.push(...contResult.proofs)
            emptyBatches = 0
            if (
              contResult.lastCounterWithSignature !== undefined &&
              (lastCounter === undefined ||
                contResult.lastCounterWithSignature > lastCounter)
            ) {
              lastCounter = contResult.lastCounterWithSignature
            }
          } else {
            emptyBatches += 1
          }
          nextCounter += RESTORE_BATCH_SIZE
        }
      }
    } catch {
      // Continue to next keyset on failure
    }
  }

  if (allProofs.length === 0) {
    return { proofs: [] }
  }

  const proofStates = await wallet.checkProofsStates(allProofs)

  const unspentProofs: EcashProof[] = allProofs
    .filter((_, idx) => proofStates[idx]?.state === CheckStateEnum.UNSPENT)
    .map((p) => ({ ...p, mintUrl }))

  return {
    lastCounter,
    proofs: unspentProofs
  }
}

async function loadKeysForKeyset(
  wallet: Wallet,
  keysetId: string
): Promise<void> {
  const walletWithKeys = wallet as unknown as {
    getKeys?: (keysetId: string) => Promise<unknown>
  }
  if (typeof walletWithKeys.getKeys === 'function') {
    await walletWithKeys.getKeys(keysetId)
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error('Operation timed out')), ms)
    })
  ])
}

export function clearWalletCache(accountId?: string, mintUrl?: string): void {
  if (accountId && mintUrl) {
    walletCache.delete(walletCacheKey(accountId, mintUrl))
  } else if (accountId) {
    const prefix = `${accountId}:`
    for (const key of walletCache.keys()) {
      if (key.startsWith(prefix)) {
        walletCache.delete(key)
      }
    }
  } else {
    walletCache.clear()
  }
}
