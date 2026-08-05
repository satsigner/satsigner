type PayjoinLogValue = string | number | boolean | undefined | null

type PayjoinLogFields = Record<string, PayjoinLogValue>

function mailboxFromEndpoint(pjEndpoint?: string): string | undefined {
  if (!pjEndpoint) {
    return undefined
  }
  return pjEndpoint.split('/').pop()?.split('#')[0]
}

function mailboxFromUri(payjoinUri?: string): string | undefined {
  if (!payjoinUri) {
    return undefined
  }
  try {
    const match = payjoinUri.match(/[?&]pj=([^&]+)/i)
    if (!match?.[1]) {
      return undefined
    }
    return mailboxFromEndpoint(decodeURIComponent(match[1]))
  } catch {
    return undefined
  }
}

function urlHost(url?: string): string | undefined {
  if (!url) {
    return undefined
  }
  try {
    return new URL(url).host
  } catch {
    return 'invalid-url'
  }
}

function compactError(error: unknown, maxLen = 160): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.length > maxLen ? `${message.slice(0, maxLen)}…` : message
}

function payjoinLog(step: string, fields?: PayjoinLogFields): void {
  if (fields && Object.keys(fields).length > 0) {
    console.log(`[payjoin] ${step}`, fields)
    return
  }
  console.log(`[payjoin] ${step}`)
}

function payjoinWarn(step: string, fields?: PayjoinLogFields): void {
  if (fields && Object.keys(fields).length > 0) {
    console.warn(`[payjoin] ${step}`, fields)
    return
  }
  console.warn(`[payjoin] ${step}`)
}

export {
  compactError,
  mailboxFromEndpoint,
  mailboxFromUri,
  payjoinLog,
  payjoinWarn,
  urlHost
}

export type { PayjoinLogFields }
