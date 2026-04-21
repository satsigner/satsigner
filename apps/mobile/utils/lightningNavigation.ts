import { type Href } from 'expo-router'

export function lightningChannelHref(chanId: string): Href {
  return `/signer/lightning/node/channel/${encodeURIComponent(chanId)}` as Href
}
