import { bech32 } from 'bech32'

// Types for LNURL-pay response
export interface LNURLPayResponse {
  callback: string
  maxSendable: number
  minSendable: number
  metadata: string
  tag: 'payRequest'
  commentAllowed?: number
  nostrPubkey?: string
  allowsNostr?: boolean
}

interface LNURLPayInvoiceResponse {
  pr: string // bolt11 invoice
  routes: unknown[] // payment routes, not used in our implementation
}

export type LNURLWithdrawDetails = {
  callback: string
  k1: string
  minWithdrawable: number
  maxWithdrawable: number
  defaultDescription?: string
  tag: 'withdrawRequest'
}

export type LNURLWithdrawResponse = {
  status: 'OK' | 'ERROR'
  pr?: string
  reason?: string
}

export type LNURLType = 'pay' | 'withdraw'

// Check if a string is a LNURL and determine its type
export function getLNURLType(input: string): {
  isLNURL: boolean
  type?: LNURLType
} {
  const lowercaseInput = input.toLowerCase()
  const isLNURLInput =
    lowercaseInput.startsWith('lnurl') ||
    lowercaseInput.startsWith('lightning:lnurl')

  if (!isLNURLInput) {
    return { isLNURL: false }
  }

  // Try to decode to check the URL
  try {
    const url = decodeLNURL(input)

    // Check for common LNURL patterns
    const isPay =
      url.includes('/lnurlp/') ||
      url.includes('/.well-known/lnurlp/') ||
      url.includes('/api/v1/lnurl/pay/') ||
      url.includes('/pay/api/v1/lnurl/') ||
      url.includes('/lnurl/pay/') ||
      url.includes('/lnurlp/api/') ||
      url.includes('/api/lnurlp/') ||
      url.includes('/lnurlp/api/v1/') ||
      url.includes('/api/v1/lnurlp/')

    const isWithdraw =
      url.includes('/lnurlw/') ||
      url.includes('/.well-known/lnurlw/') ||
      url.includes('/api/v1/lnurl/withdraw/') ||
      url.includes('/withdraw/api/v1/lnurl/') ||
      url.includes('/lnurl/withdraw/') ||
      url.includes('/lnurlw/api/') ||
      url.includes('/api/lnurlw/') ||
      url.includes('/lnurlw/api/v1/') ||
      url.includes('/api/v1/lnurlw/')

    if (isPay) {
      return { isLNURL: true, type: 'pay' }
    } else if (isWithdraw) {
      return { isLNURL: true, type: 'withdraw' }
    }

    return { isLNURL: true }
  } catch {
    // If decoding fails, just return that it's a LNURL without type
    return { isLNURL: true }
  }
}

// Update isLNURL to use the new function
export function isLNURL(input: string): boolean {
  return getLNURLType(input).isLNURL
}

// Decode a LNURL from bech32 format
export function decodeLNURL(input: string): string {
  try {
    // Remove 'lightning:' prefix if present (case insensitive)
    let cleanInput = input.trim()
    if (cleanInput.toLowerCase().startsWith('lightning:')) {
      cleanInput = cleanInput.substring(10) // Remove 'lightning:' prefix
    }

    // Bech32 strings must be lowercase
    cleanInput = cleanInput.toLowerCase()

    // Basic validation - just check it starts with lnurl and has content
    if (!cleanInput.startsWith('lnurl') || cleanInput.length < 6) {
      throw new Error('Invalid LNURL format: must start with lnurl')
    }

    // Decode bech32 - let the library do the real validation
    let decoded
    try {
      decoded = bech32.decode(cleanInput, 1023) // Increase max length
    } catch (bech32Error) {
      const errorMessage =
        bech32Error instanceof Error ? bech32Error.message : String(bech32Error)
      if (
        errorMessage.includes('Invalid') ||
        errorMessage.includes('invalid') ||
        errorMessage.includes('Bech32') ||
        errorMessage.includes('bech32')
      ) {
        throw new Error(`Bech32 string is not valid: ${errorMessage}`)
      }
      throw new Error(`Failed to decode bech32: ${errorMessage}`)
    }

    if (!decoded || !decoded.words || decoded.words.length === 0) {
      throw new Error(
        'Invalid LNURL format: bech32 decode returned empty result'
      )
    }

    // Convert to bytes and then to string
    const urlBytes = bech32.fromWords(decoded.words)
    const url = Buffer.from(urlBytes).toString('utf8')

    // Validate URL format
    try {
      // eslint-disable-next-line no-new
      new URL(url)
      return url
    } catch {
      throw new Error('Invalid URL in LNURL')
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    // If the error already contains "Bech32", pass it through
    if (errorMessage.includes('Bech32') || errorMessage.includes('bech32')) {
      throw error
    }
    throw new Error(`Failed to decode LNURL: ${errorMessage}`)
  }
}

// Fetch LNURL-pay details
export async function fetchLNURLPayDetails(
  url: string
): Promise<LNURLPayResponse> {
  try {
    // Try to fetch from the base URL first
    let response = await fetch(url)

    // If we get a 404, try with /api/v1/lnurl/pay/ prefix
    if (response.status === 404) {
      const apiUrl = new URL(url)
      const pathParts = apiUrl.pathname.split('/')
      const lastPart = pathParts[pathParts.length - 1]

      // Try different API URL patterns
      const apiPatterns = [
        `/api/v1/lnurl/pay/${lastPart}`,
        `/api/lnurlp/${lastPart}`,
        `/lnurlp/api/v1/${lastPart}`,
        `/api/v1/lnurlp/${lastPart}`
      ]

      for (const pattern of apiPatterns) {
        apiUrl.pathname = pattern
        response = await fetch(apiUrl.toString())

        if (response.ok) {
          break
        }
      }
    }

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }

    const data = await response.json()

    // Validate response format
    if (data.tag !== 'payRequest') {
      throw new Error('Invalid LNURL response: not a pay request')
    }

    if (
      !data.callback ||
      !data.maxSendable ||
      !data.minSendable ||
      !data.metadata
    ) {
      throw new Error('Invalid LNURL response: missing required fields')
    }

    return data as LNURLPayResponse
  } catch (error) {
    throw new Error(
      `Failed to fetch LNURL details: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    )
  }
}

// Request a bolt11 invoice from LNURL-pay endpoint
export async function requestLNURLPayInvoice(
  callback: string,
  amount: number,
  comment?: string,
  details?: LNURLPayResponse
): Promise<string> {
  try {
    // Convert sats to millisats for the request
    const amountMillisats = amount * 1000

    // Build callback URL with parameters
    const url = new URL(callback)
    url.searchParams.append('amount', amountMillisats.toString())
    if (comment && details?.commentAllowed) {
      if (comment.length > details.commentAllowed) {
        throw new Error(
          `Comment too long. Maximum length: ${details.commentAllowed}`
        )
      }
      url.searchParams.append('comment', comment)
    }

    // Request invoice
    const response = await fetch(url.toString())

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`)
    }

    const data = (await response.json()) as LNURLPayInvoiceResponse

    if (!data.pr) {
      throw new Error('Invalid response: no payment request received')
    }

    return data.pr
  } catch (error) {
    throw new Error(
      `Failed to request invoice: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    )
  }
}

// Main function to handle LNURL-pay flow
export async function handleLNURLPay(
  lnurl: string,
  amount: number,
  comment?: string
): Promise<string> {
  try {
    // Clean the input first - remove any whitespace and lightning: prefix
    const cleanLnurl = lnurl.trim().replace(/^lightning:/i, '')

    // Decode LNURL if needed
    const isLNURLInput = isLNURL(cleanLnurl)
    const url = isLNURLInput ? decodeLNURL(cleanLnurl) : cleanLnurl

    // Get LNURL details and validate amount
    const details = await fetchLNURLPayDetails(url)
    const amountMillisats = amount * 1000

    // Validate amount is within allowed range
    if (
      amountMillisats < details.minSendable ||
      amountMillisats > details.maxSendable
    ) {
      throw new Error(
        `Amount must be between ${details.minSendable / 1000} and ${
          details.maxSendable / 1000
        } sats`
      )
    }

    // Request and return the invoice
    const invoice = await requestLNURLPayInvoice(
      details.callback,
      amount,
      comment,
      details
    )
    return invoice
  } catch (error) {
    throw new Error(
      `LNURL-pay failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    )
  }
}

export async function fetchLNURLWithdrawDetails(
  url: string
): Promise<LNURLWithdrawDetails> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  const data = await response.json()

  if (data.tag !== 'withdrawRequest') {
    throw new Error('Invalid LNURL: not a withdraw request')
  }

  if (
    !data.callback ||
    !data.k1 ||
    typeof data.minWithdrawable !== 'number' ||
    typeof data.maxWithdrawable !== 'number'
  ) {
    throw new Error('Invalid LNURL withdraw details: missing required fields')
  }

  return {
    callback: data.callback,
    k1: data.k1,
    minWithdrawable: data.minWithdrawable,
    maxWithdrawable: data.maxWithdrawable,
    defaultDescription: data.defaultDescription,
    tag: data.tag
  }
}

export async function requestLNURLWithdrawInvoice(
  callback: string,
  amount: number,
  k1: string,
  description?: string,
  pr?: string
): Promise<LNURLWithdrawResponse> {
  // Convert millisats to sats for the request
  const amountSats = Math.floor(amount / 1000)

  // Build callback URL with parameters
  const url = new URL(callback)
  url.searchParams.append('k1', k1)
  url.searchParams.append('amount', amountSats.toString())
  if (description) {
    url.searchParams.append('description', description)
  }
  if (pr) {
    url.searchParams.append('pr', pr)
  }

  const response = await fetch(url.toString())
  if (!response.ok) {
    const errorText = await response.text()

    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
  }

  const data = await response.json()

  if (data.status === 'ERROR') {
    throw new Error(data.reason || 'Unknown error from LNURL service')
  }

  if (data.status !== 'OK') {
    throw new Error('Invalid response from LNURL service')
  }

  return data
}
