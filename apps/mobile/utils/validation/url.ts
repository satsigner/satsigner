export type Protocol = 'tcp' | 'ssl' | 'tls'

export type ValidationResult = {
  isValid: boolean
  error?: string
}

export function isValidDomainName(host: string): boolean {
  return /^[a-z][a-z0-9.-]*[a-z0-9]$/i.test(host)
}

export function isValidIPAddress(host: string): boolean {
  return /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
    host
  )
}

export function isValidPort(port: string): boolean {
  return /^[0-9]+$/.test(port)
}

export function isValidProtocol(protocol: string): protocol is Protocol {
  return protocol === 'ssl' || protocol === 'tls' || protocol === 'tcp'
}

export function validateElectrumUrl(url: string): ValidationResult {
  // Check if URL has the expected format
  if (!url.includes('://') || !url.includes(':')) {
    return {
      isValid: false,
      error: 'Invalid URL format'
    }
  }

  const port = url.replace(/.*:/, '')
  const protocol = url.replace(/:\/\/.*/, '')
  const host = url.replace(`${protocol}://`, '').replace(`:${port}`, '')

  if (!isValidProtocol(protocol)) {
    return {
      isValid: false,
      error: 'Invalid protocol. Must be tcp, ssl, or tls'
    }
  }

  if (!isValidDomainName(host) && !isValidIPAddress(host)) {
    return {
      isValid: false,
      error: 'Invalid host. Must be a valid domain name or IP address'
    }
  }

  if (!isValidPort(port)) {
    return {
      isValid: false,
      error: 'Invalid port. Must be a valid number'
    }
  }

  return { isValid: true }
}

export function validateEsploraUrl(url: string): ValidationResult {
  if (!url.startsWith('https://')) {
    return {
      isValid: false,
      error: 'Invalid URL: Esplora must use HTTPS protocol!'
    }
  }

  if (!URL.canParse(url)) {
    return {
      isValid: false,
      error: 'Invalid URL format'
    }
  }

  return { isValid: true }
}
