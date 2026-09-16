import { type Href } from 'expo-router'

export function lightningChannelHref(chanId: string): Href {
  return `/signer/lightning/node/channel/${encodeURIComponent(chanId)}` as Href
}

export function lightningOpenChannelHref(pubkey?: string): Href {
  if (!pubkey) {
    return '/signer/lightning/node/open-channel' as Href
  }
  return {
    params: { pubkey },
    pathname: '/signer/lightning/node/open-channel'
  } as Href
}
