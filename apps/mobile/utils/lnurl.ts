import { bech32 } from 'bech32'

import { MILLISATS_PER_SAT } from '@/constants/btc'
import type {
  LNURLPayInvoiceResponse,
  LNURLPayResponse,
  LNURLWithdrawDetails,
  LNURLWithdrawResponse
} from '@/types/models/Lightning'
import { decodeLightningInvoice } from '@/utils/lightningInvoiceDecoder'

const LNURL_BECH32_MAX_LENGTH = 1023

// Per LUD-06 the service must return an invoice for exactly the requested
// amount. A malicious or compromised LNURL service could otherwise answer a
// "pay 1,000 sats" request with a 1,000,000 sats invoice that gets paid
// without any user-visible discrepancy.
function assertInvoiceMatchesRequest(
  invoice: string,
  expectedAmountMillisats: number
): void {
  let decoded
  try {
    decoded = decodeLightningInvoice(invoice)
  } catch {
    throw new Error('LNURL service returned an invalid invoice')
  }
  const invoiceMillisats = Number(decoded.num_msat)
  if (!Number.isFinite(invoiceMillisats) || invoiceMillisats <= 0) {
    throw new Error('LNURL service returned an invoice without an amount')
  }
  if (invoiceMillisats !== expectedAmountMillisats) {
    throw new Error(
      'LNURL service returned an invoice for a different amount than requested'
    )
  }
}

function assertHttpsUrl(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid LNURL URL')
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('LNURL must use HTTPS')
  }
}

export function getLNURLType(input: string) {
  const lowercaseInput = input.toLowerCase()
  const isLNURLInput =
    lowercaseInput.startsWith('lnurl') ||
    lowercaseInput.startsWith('lightning:lnurl')

  if (!isLNURLInput) {
    return { isLNURL: false }
  }

  const url = decodeLNURL(input)

  const isPay = [
    '/.well-known/lnurlp/',
    '/api/lnurlp/',
    '/api/v1/lnurl/pay/',
    '/api/v1/lnurlp/',
    '/lnurl/pay/',
    '/lnurlp/',
    '/lnurlp/api/',
    '/lnurlp/api/v1/',
    '/pay/api/v1/lnurl/'
  ].some((path) => url.includes(path))

  const isWithdraw = [
    '/.well-known/lnurlw/',
    '/api/lnurlw/',
    '/api/v1/lnurl/withdraw/',
    '/api/v1/lnurlw/',
    '/lnurl/withdraw/',
    '/lnurlw/',
    '/lnurlw/api/',
    '/lnurlw/api/v1/',
    '/withdraw/api/v1/lnurl/'
  ].some((path) => url.includes(path))

  if (isPay) {
    return { isLNURL: true, type: 'pay' }
  } else if (isWithdraw) {
    return { isLNURL: true, type: 'withdraw' }
  }

  return { isLNURL: true }
}

export function isLNURL(input: string): boolean {
  const lowercaseInput = input.toLowerCase()
  return (
    lowercaseInput.startsWith('lnurl') ||
    lowercaseInput.startsWith('lightning:lnurl')
  )
}

export function decodeLNURL(input: string): string {
  let cleanInput = input.trim().toLowerCase()
  if (cleanInput.toLowerCase().startsWith('lightning:')) {
    cleanInput = cleanInput.substring('lightning:'.length)
  }

  if (!cleanInput.startsWith('lnurl') || cleanInput.length < 6) {
    throw new Error('Invalid LNURL format: must start with lnurl')
  }

  let decoded
  try {
    decoded = bech32.decode(cleanInput, LNURL_BECH32_MAX_LENGTH) // Increase max length
  } catch {
    throw new Error(`Failed to decode bech32`)
  }

  if (!decoded || !decoded.words || decoded.words.length === 0) {
    throw new Error('Invalid LNURL format: bech32 decode returned empty result')
  }

  const urlBytes = bech32.fromWords(decoded.words)
  const url = Buffer.from(urlBytes).toString('utf8')
  if (!URL.canParse(url)) {
    throw new Error('Unable to parse URL')
  }
  assertHttpsUrl(url)

  return url
}

export function resolveLnurlUrl(raw: string): string {
  const cleaned = raw.trim().replace(/^lightning:/i, '')
  return isLNURL(cleaned) ? decodeLNURL(cleaned) : cleaned
}

export function isLnurlWithdrawAmountInRange(
  amountSats: number,
  details: Pick<LNURLWithdrawDetails, 'minWithdrawable' | 'maxWithdrawable'>
): boolean {
  const amountMillisats = amountSats * MILLISATS_PER_SAT
  return (
    amountMillisats >= details.minWithdrawable &&
    amountMillisats <= details.maxWithdrawable
  )
}

export async function fetchLNURLPayDetails(
  url: string
): Promise<LNURLPayResponse> {
  assertHttpsUrl(url)
  let response = await fetch(url)

  if (response.status === 404) {
    const apiUrl = new URL(url)
    const pathParts = apiUrl.pathname.split('/')
    const lastPart = pathParts.at(-1)!

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
}

export async function requestLNURLPayInvoice(
  callback: string,
  amount: number,
  comment?: string,
  details?: LNURLPayResponse
): Promise<string> {
  const amountMillisats = amount * MILLISATS_PER_SAT

  assertHttpsUrl(callback)
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

  const response = await fetch(url.toString())

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`)
  }

  const data = (await response.json()) as LNURLPayInvoiceResponse

  if (!data.pr) {
    throw new Error('Invalid response: no payment request received')
  }

  assertInvoiceMatchesRequest(data.pr, amountMillisats)

  return data.pr
}

export async function handleLNURLPay(
  lnurl: string,
  amount: number,
  comment?: string
): Promise<string> {
  const cleanLnurl = lnurl.trim().replace(/^lightning:/i, '')
  const isLNURLInput = isLNURL(cleanLnurl)
  const url = isLNURLInput ? decodeLNURL(cleanLnurl) : cleanLnurl
  const details = await fetchLNURLPayDetails(url)
  const amountMillisats = amount * MILLISATS_PER_SAT

  if (
    amountMillisats < details.minSendable ||
    amountMillisats > details.maxSendable
  ) {
    throw new Error(
      `Amount must be between ${details.minSendable / MILLISATS_PER_SAT} and ${
        details.maxSendable / MILLISATS_PER_SAT
      } sats`
    )
  }

  const invoice = await requestLNURLPayInvoice(
    details.callback,
    amount,
    comment,
    details
  )
  return invoice
}

export async function fetchLNURLWithdrawDetails(
  url: string
): Promise<LNURLWithdrawDetails> {
  assertHttpsUrl(url)
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
    defaultDescription: data.defaultDescription,
    k1: data.k1,
    maxWithdrawable: data.maxWithdrawable,
    minWithdrawable: data.minWithdrawable,
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
  assertHttpsUrl(callback)
  const amountSats = Math.floor(amount / MILLISATS_PER_SAT)
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
