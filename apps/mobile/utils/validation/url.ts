/**
 * Utility functions for URL validation
 */

export type Protocol = 'tcp' | 'ssl' | 'tls'

export type ValidationResult = {
  isValid: boolean
  error?: string
}

/**
 * Validates if a host is a valid .onion address
 * @param host - The host string to validate
 * @returns true if valid .onion address
 */
export function isValidOnionAddress(host: string): boolean {
  if (!host.endsWith('.onion')) {
    return false
  }

  const onionPart = host.replace('.onion', '')

  // v2 .onion addresses are 16 characters (base32)
  // v3 .onion addresses are 56 characters (base32)
  return /^[a-z2-7]{16}$|^[a-z2-7]{56}$/i.test(onionPart)
}

/**
 * Validates if a host is a valid domain name
 * @param host - The host string to validate
 * @returns true if valid domain name
 */
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

/**
 * Validates if a host is a valid domain name (legacy function)
 * @param host - The host string to validate
 * @returns true if valid domain name
 */
export function isDomainName(host: string): boolean {
  // Validate host: allow domain names (starting with letter) or IP addresses
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

/**
 * Validates if a proxy host is valid
 * @param host - The proxy host string to validate
 * @returns true if valid proxy host
 */
export function isValidProxyHost(host: string): boolean {
  // Allow localhost, IP addresses, and domain names
  return (
    host === 'localhost' || isValidIPAddress(host) || isValidDomainName(host)
  )
}

/**
 * Validates proxy configuration
 * @param host - The proxy host
 * @param port - The proxy port
 * @returns ValidationResult with isValid and optional error message
 */
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
