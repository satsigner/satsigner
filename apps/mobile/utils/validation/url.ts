/**
 * Utility functions for URL validation
 */

export type Protocol = 'tcp' | 'ssl' | 'tls'

export type ValidationResult = {
  isValid: boolean
  error?: string
}

export function isValidOnionAddress(host: string): boolean {
  if (!host.endsWith('.onion')) {
    return false
  }

  const onionPart = host.replace('.onion', '')

  // v2 .onion addresses are 16 characters (base32)
  // v3 .onion addresses are 56 characters (base32)
  return /^[a-z2-7]{16}$|^[a-z2-7]{56}$/i.test(onionPart)
}

export function isValidDomainName(host: string): boolean {
  // Check for .onion addresses first
  if (isValidOnionAddress(host)) {
    return true
  }

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

export function isDomainName(host: string): boolean {
  // Validate host: allow domain names (starting with letter) or IP addresses
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

export function isValidProxyHost(host: string): boolean {
  // Allow localhost, IP addresses, and domain names
  return (
    host === 'localhost' || isValidIPAddress(host) || isValidDomainName(host)
  )
}

export function validateProxyConfig(
  host: string,
  port: string
): ValidationResult {
  if (!host.trim()) {
    return {
      isValid: false,
      error: 'Invalid proxy host'
    }
  }

  if (!isValidProxyHost(host)) {
    return {
      isValid: false,
      error: 'Invalid proxy host'
    }
  }

  if (!isValidPort(port)) {
    return {
      isValid: false,
      error: 'Invalid proxy port'
    }
  }

  const portNum = parseInt(port, 10)
  if (portNum < 1 || portNum > 65535) {
    return {
      isValid: false,
      error: 'Invalid proxy port'
    }
  }

  return { isValid: true }
}
