export function isValidDomainName(host: string) {
  return /^[a-z][a-z0-9.-]*[a-z0-9]$/i.test(host)
}

export function isValidIPAddress(host: string) {
  return /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
    host
  )
}

export function isValidPort(port: string) {
  return /^[0-9]+$/.test(port)
}

export function isValidProtocol(protocol: string) {
  return protocol === 'ssl' || protocol === 'tls' || protocol === 'tcp'
}

export function validateElectrumUrl(url: string) {
  if (!url.includes('://') || !url.includes(':')) {
    return false
  }

  const port = url.replace(/.*:/, '')
  const protocol = url.replace(/:\/\/.*/, '')
  const host = url.replace(`${protocol}://`, '').replace(`:${port}`, '')

  return (
    isValidProtocol(protocol) &&
    (isValidDomainName(host) || isValidIPAddress(host)) &&
    isValidPort(port)
  )
}

export function validateEsploraUrl(url: string) {
  return url.startsWith('https://') && URL.canParse(url)
}
