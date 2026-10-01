import { Linking } from 'react-native'
import { toast } from 'sonner-native'

export async function openUrl(url: string) {
  try {
    await Linking.openURL(url)
  } catch {
    toast.error('Failed to open URL')
  }
}

export function isValidDomainName(host: string) {
  return /^[a-z][a-z0-9.-]*[a-z0-9]$/i.test(host)
}

export function isValidIPAddress(host: string) {
  return /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
    host
  )
}
