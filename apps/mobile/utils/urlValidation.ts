/**
 * Utility functions for URL validation
 */

export type Protocol = 'tcp' | 'ssl' | 'tls'

export type ValidationResult = {
  isValid: boolean
  error?: string
}

/**
 * Validates if a host is a valid domain name
 * @param host - The host string to validate
 * @returns true if valid domain name
 */
export function isValidDomainName(host: string): boolean {
  // Check for double dots, leading/trailing hyphens, and consecutive hyphens
  if (
    host.includes('..') ||
    host.startsWith('-') ||
    host.endsWith('-') ||
    host.includes('--')
  ) {
    return false
  }

  // Check for hyphen before or after dot
  if (host.includes('-.') || host.includes('.-')) {
    return false
  }

  return /^[a-z][a-z0-9.-]*[a-z0-9]$/i.test(host)
}

/**
 * Validates if a host is a valid IP address
 * @param host - The host string to validate
 * @returns true if valid IP address
 */
export function isValidIPAddress(host: string): boolean {
  return /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
    host
  )
}

/**
 * Validates if a port is a valid number
 * @param port - The port string to validate
 * @returns true if valid port
 */
export function isValidPort(port: string): boolean {
  return /^[0-9]+$/.test(port)
}

/**
 * Validates if a protocol is supported
 * @param protocol - The protocol to validate
 * @returns true if supported protocol
 */
export function isValidProtocol(protocol: string): protocol is Protocol {
  return protocol === 'ssl' || protocol === 'tls' || protocol === 'tcp'
}

/**
 * Validates an Electrum URL
 * @param url - The URL to validate
 * @returns ValidationResult with isValid and optional error message
 */
export function validateElectrumUrl(url: string): ValidationResult {
  try {
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
  } catch {
    return {
      isValid: false,
      error: 'Invalid URL format'
    }
  }
}

/**
 * Validates an Esplora URL
 * @param url - The URL to validate
 * @returns ValidationResult with isValid and optional error message
 */
export function validateEsploraUrl(url: string): ValidationResult {
  if (!url.startsWith('https://')) {
    return {
      isValid: false,
      error: 'Invalid URL. Esplora URLs must use HTTPS protocol'
    }
  }

  try {
    // eslint-disable-next-line no-new
    new URL(url)
    return { isValid: true }
  } catch {
    return {
      isValid: false,
      error: 'Invalid URL format'
    }
  }
}
