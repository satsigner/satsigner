import { type Href } from 'expo-router'

export function lightningChannelHref(chanId: string): Href {
  return {
    params: { chanId },
    pathname: '/signer/lightning/node/channel/[chanId]'
  }
}

export function lightningOpenChannelHref(pubkey?: string): Href {
  if (!pubkey) {
    return '/signer/lightning/node/open-channel'
  }
  return {
    params: { pubkey },
    pathname: '/signer/lightning/node/open-channel'
  }
}
