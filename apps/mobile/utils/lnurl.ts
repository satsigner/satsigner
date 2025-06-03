/* eslint-disable no-console */
import { bech32 } from 'bech32'

// Types for LNURL-pay response
interface LNURLPayResponse {
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
  routes: any[] // payment routes, not used in our implementation
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
    console.log('🔍 Decoded LNURL:', url)

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
      console.log('📝 Detected LNURL-pay')
      return { isLNURL: true, type: 'pay' }
    } else if (isWithdraw) {
      console.log('📝 Detected LNURL-withdraw')
      return { isLNURL: true, type: 'withdraw' }
    }

    // If we can't determine the type from the URL, try to fetch the details
    console.log(
      '⚠️ Could not determine LNURL type from URL, will need to fetch details'
    )
    return { isLNURL: true }
  } catch (error) {
    console.error('❌ Failed to decode LNURL:', error)
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
    console.log('🔍 Attempting to decode LNURL:', input)
    // Remove 'lightning:' prefix if present
    const cleanInput = input.toLowerCase().replace('lightning:', '')
    console.log('🧹 Cleaned input:', cleanInput)

    // Split into prefix and data if it's a bech32m string
    const [prefix, data] = cleanInput.split('1')
    if (!prefix || !data) {
      throw new Error('Invalid LNURL format: missing prefix or data')
    }

    console.log('📝 Decoding parts:', { prefix, dataLength: data.length })

    // Decode bech32
    const decoded = bech32.decode(cleanInput, 1023) // Increase max length
    if (!decoded) {
      throw new Error('Invalid LNURL format: bech32 decode failed')
    }

    console.log('✅ Bech32 decoded:', {
      prefix: decoded.prefix,
      wordsLength: decoded.words.length
    })

    // Convert to bytes and then to string
    const urlBytes = bech32.fromWords(decoded.words)
    const url = Buffer.from(urlBytes).toString('utf8')

    console.log('🔗 Decoded URL:', url)

    // Validate URL format
    try {
      // eslint-disable-next-line no-new
      new URL(url)
      return url
    } catch {
      throw new Error('Invalid URL in LNURL')
    }
  } catch (error) {
    console.error('❌ Failed to decode LNURL:', error)
    throw new Error(
      `Failed to decode LNURL: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

// Fetch LNURL-pay details
export async function fetchLNURLPayDetails(
  url: string
): Promise<LNURLPayResponse> {
  try {
    console.log('🔍 Fetching LNURL details from:', url)

    // Try to fetch from the base URL first
    let response = await fetch(url)
    console.log('📡 LNURL response status:', response.status)

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
        console.log('🔄 Trying alternative URL:', apiUrl.toString())
        response = await fetch(apiUrl.toString())
        console.log('📡 Alternative URL response status:', response.status)

        if (response.ok) {
          console.log('✅ Found working LNURL endpoint:', apiUrl.toString())
          break
        }
      }
    }

    if (!response.ok) {
      console.error(
        '❌ LNURL fetch failed:',
        response.status,
        response.statusText
      )
      throw new Error(`HTTP error! Status: ${response.status}`)
    }

    const data = await response.json()
    console.log('📦 LNURL response data:', JSON.stringify(data, null, 2))

    // Validate response format
    if (data.tag !== 'payRequest') {
      console.error('❌ Invalid LNURL tag:', data.tag)
      throw new Error('Invalid LNURL response: not a pay request')
    }

    if (
      !data.callback ||
      !data.maxSendable ||
      !data.minSendable ||
      !data.metadata
    ) {
      console.error('❌ Missing required fields:', {
        hasCallback: !!data.callback,
        hasMaxSendable: !!data.maxSendable,
        hasMinSendable: !!data.minSendable,
        hasMetadata: !!data.metadata
      })
      throw new Error('Invalid LNURL response: missing required fields')
    }

    console.log('✅ LNURL details fetched successfully:', {
      callback: data.callback,
      minSendable: data.minSendable,
      maxSendable: data.maxSendable,
      commentAllowed: data.commentAllowed
    })

    return data as LNURLPayResponse
  } catch (error) {
    console.error('❌ LNURL fetch error:', error)
    throw new Error(
      `Failed to fetch LNURL details: ${error instanceof Error ? error.message : 'Unknown error'}`
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
    console.log('🔍 Requesting invoice with params:', {
      callback,
      amount,
      amountMillisats: amount * 1000,
      comment: comment || 'none'
    })

    // Convert sats to millisats for the request
    const amountMillisats = amount * 1000

    // Build callback URL with parameters
    const url = new URL(callback)
    url.searchParams.append('amount', amountMillisats.toString())
    if (comment && details?.commentAllowed) {
      if (comment.length > details.commentAllowed) {
        console.error('❌ Comment too long:', {
          length: comment.length,
          maxAllowed: details.commentAllowed
        })
        throw new Error(
          `Comment too long. Maximum length: ${details.commentAllowed}`
        )
      }
      url.searchParams.append('comment', comment)
    }

    console.log('🔗 Requesting invoice from URL:', url.toString())

    // Request invoice
    const response = await fetch(url.toString())
    console.log('📡 Invoice response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Invoice request failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      })
      throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`)
    }

    const data = (await response.json()) as LNURLPayInvoiceResponse
    console.log('📦 Invoice response data:', JSON.stringify(data, null, 2))

    if (!data.pr) {
      console.error('❌ No payment request in response')
      throw new Error('Invalid response: no payment request received')
    }

    console.log('✅ Invoice received successfully')
    return data.pr
  } catch (error) {
    console.error('❌ Invoice request error:', error)
    throw new Error(
      `Failed to request invoice: ${error instanceof Error ? error.message : 'Unknown error'}`
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
    console.log('🚀 Starting LNURL-pay flow:', {
      lnurl: lnurl.substring(0, 50) + '...', // Log only first 50 chars for privacy
      amount,
      hasComment: !!comment
    })

    // Decode LNURL if needed
    const url = isLNURL(lnurl) ? decodeLNURL(lnurl) : lnurl
    console.log('🔑 Decoded LNURL:', url)

    // Get LNURL details and validate amount
    const details = await fetchLNURLPayDetails(url)
    const amountMillisats = amount * 1000

    // Validate amount is within allowed range
    if (
      amountMillisats < details.minSendable ||
      amountMillisats > details.maxSendable
    ) {
      console.error('❌ Amount out of range:', {
        amount,
        amountMillisats,
        min: details.minSendable,
        max: details.maxSendable
      })
      throw new Error(
        `Amount must be between ${details.minSendable / 1000} and ${details.maxSendable / 1000} sats`
      )
    }

    // Request and return the invoice
    const invoice = await requestLNURLPayInvoice(
      details.callback,
      amount,
      comment,
      details
    )
    console.log('✅ LNURL-pay flow completed successfully')
    return invoice
  } catch (error) {
    console.error('❌ LNURL-pay flow failed:', error)
    throw new Error(
      `LNURL-pay failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function fetchLNURLWithdrawDetails(
  url: string
): Promise<LNURLWithdrawDetails> {
  console.log('🔍 Fetching LNURL withdraw details from:', url)
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    console.log('📦 Received LNURL withdraw details:', data)

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
  } catch (error) {
    console.error('❌ Failed to fetch LNURL withdraw details:', error)
    throw error
  }
}

export async function requestLNURLWithdrawInvoice(
  callback: string,
  amount: number,
  k1: string,
  description?: string,
  pr?: string
): Promise<LNURLWithdrawResponse> {
  console.log('💫 Requesting LNURL withdraw invoice:', {
    callback,
    amount,
    amountSats: Math.floor(amount / 1000),
    k1,
    hasDescription: !!description,
    hasPr: !!pr
  })

  try {
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

    console.log('🔗 Making withdraw request to:', url.toString())
    const response = await fetch(url.toString())
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Withdraw request failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      })
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('📦 Received withdraw response:', data)

    if (data.status === 'ERROR') {
      throw new Error(data.reason || 'Unknown error from LNURL service')
    }

    if (data.status !== 'OK') {
      throw new Error('Invalid response from LNURL service')
    }

    return data
  } catch (error) {
    console.error('❌ Failed to request LNURL withdraw invoice:', error)
    throw error
  }
}
