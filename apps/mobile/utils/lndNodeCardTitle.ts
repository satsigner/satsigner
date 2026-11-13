import {
  LND_NODE_CARD_PUBKEY_HEAD_CHARS,
  LND_NODE_CARD_PUBKEY_TAIL_CHARS,
  LND_NODE_PUBKEY_HEX_LENGTH
} from '@/constants/lightning'
import { t } from '@/locales'
import type { LNDNodeInfo } from '@/types/models/Lightning'
import { truncate } from '@/utils/format'

const PUBKEY_HEX_REGEX = new RegExp(
  `^[0-9a-fA-F]{${LND_NODE_PUBKEY_HEX_LENGTH}}$`
)

export function lndAliasIsNodeId(
  alias: string,
  identityPubkey: string
): boolean {
  const a = alias.trim()
  const pk = identityPubkey.trim()
  if (!a) {
    return true
  }
  if (pk && a === pk) {
    return true
  }
  return PUBKEY_HEX_REGEX.test(a)
}

export function lndNodeCardTitle(
  alias: string,
  identityPubkey: string
): string {
  const a = alias.trim()
  const pk = identityPubkey.trim()
  if (!lndAliasIsNodeId(a, pk)) {
    return a
  }
  const source = pk || a
  if (!source) {
    return ''
  }
  return truncate(
    source,
    LND_NODE_CARD_PUBKEY_HEAD_CHARS,
    LND_NODE_CARD_PUBKEY_TAIL_CHARS
  )
}

export function lndNodeTitle(
  nodeInfo: Pick<LNDNodeInfo, 'alias' | 'identity_pubkey'> | undefined
): string {
  return (
    lndNodeCardTitle(nodeInfo?.alias ?? '', nodeInfo?.identity_pubkey ?? '') ||
    t('lightning.landing.unknownNode')
  )
}
