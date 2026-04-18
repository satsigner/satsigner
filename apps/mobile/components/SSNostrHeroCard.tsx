import {
  Image,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle
} from 'react-native'

import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSText from '@/components/SSText'
import { NOSTR_PRIVACY_MASK } from '@/constants/nostr'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import {
  type NostrIdentity,
  type NostrRelayConnectionInfo
} from '@/types/models/NostrIdentity'
import { truncateNpub } from '@/utils/nostrIdentity'

function disconnectReasonLabel(
  reason?: NostrRelayConnectionInfo['reason']
): string {
  switch (reason) {
    case 'no_internet':
      return t('nostrIdentity.account.relayNoInternet')
    case 'no_relays':
      return t('nostrIdentity.account.relayNoRelays')
    case 'all_failed':
      return t('nostrIdentity.account.relayAllFailed')
    case 'user_disabled':
      return t('nostrIdentity.account.relayUserDisabled')
    default:
      return t('nostrIdentity.account.relayDisconnected')
  }
}

function formatRelayUrl(url: string): string {
  return url.replace(/^wss?:\/\//, '').replace(/\/$/, '')
}

function buildDisconnectLabel(info: NostrRelayConnectionInfo): string {
  const reason = disconnectReasonLabel(info.reason)
  if (info.reason !== 'all_failed' || !info.relayDetails) {
    return reason
  }
  const failed = info.relayDetails.filter((r) => !r.connected && r.error)
  if (failed.length === 0) {
    return reason
  }
  const details = failed
    .map((r) => `${formatRelayUrl(r.url)}: ${r.error}`)
    .join(' · ')
  return `${reason} — ${details}`
}

type SSNostrHeroCardProps = {
  identity: NostrIdentity
  connectionInfo?: NostrRelayConnectionInfo
  style?: StyleProp<ViewStyle>
}

function SSNostrHeroCard({
  identity,
  connectionInfo,
  style
}: SSNostrHeroCardProps) {
  const privacyMode = useSettingsStore((state) => state.privacyMode)
  const nip05Value = identity.nip05?.trim()
  const lud16Value = identity.lud16?.trim()

  return (
    <SSVStack itemsCenter gap="sm" style={[styles.container, style]}>
      <View style={styles.avatarContainer}>
        {privacyMode ? (
          <View style={[styles.avatar, styles.avatarPlaceholder]} />
        ) : identity.picture ? (
          <Image source={{ uri: identity.picture }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <SSText size="4xl" weight="bold">
              {(identity.displayName ?? identity.npub)?.[0]?.toUpperCase() ??
                'N'}
            </SSText>
          </View>
        )}
      </View>
      <SSVStack itemsCenter gap="xxs" style={styles.metaBlock}>
        <SSText size="xl" weight="medium">
          {privacyMode ? NOSTR_PRIVACY_MASK : identity.displayName || 'Unnamed'}
        </SSText>
        <SSClipboardCopy text={identity.npub}>
          <SSText size="xs" type="mono" color="muted">
            {truncateNpub(identity.npub, 12)}
          </SSText>
        </SSClipboardCopy>
        {privacyMode ? (
          <SSText center color="muted" size="sm">
            {NOSTR_PRIVACY_MASK}
          </SSText>
        ) : nip05Value ? (
          <SSClipboardCopy text={nip05Value}>
            <SSText size="sm" color="muted">
              {nip05Value}
            </SSText>
          </SSClipboardCopy>
        ) : (
          <SSText center color="muted" size="sm" style={styles.metaPlaceholder}>
            {t('nostrIdentity.account.nip05NotSet')}
          </SSText>
        )}
        {privacyMode ? (
          <SSText center color="muted" size="sm">
            {NOSTR_PRIVACY_MASK}
          </SSText>
        ) : lud16Value ? (
          <SSClipboardCopy text={lud16Value}>
            <SSText size="sm" color="white">
              {lud16Value}
            </SSText>
          </SSClipboardCopy>
        ) : (
          <SSText center color="muted" size="sm" style={styles.metaPlaceholder}>
            {t('nostrIdentity.account.lud16NotSet')}
          </SSText>
        )}
        {connectionInfo ? (
          <SSText
            center
            size="xs"
            color={connectionInfo.status === 'connected' ? 'white' : 'muted'}
            style={
              connectionInfo.status === 'connected'
                ? styles.relayTagConnected
                : connectionInfo.status === 'checking'
                  ? styles.relayTagChecking
                  : undefined
            }
          >
            {connectionInfo.status === 'checking'
              ? t('nostrIdentity.account.relayChecking')
              : connectionInfo.status === 'connected'
                ? t('nostrIdentity.account.relayConnected')
                : buildDisconnectLabel(connectionInfo)}
          </SSText>
        ) : null}
        {identity.isWatchOnly && (
          <SSText size="xs" color="muted" uppercase>
            watch only
          </SSText>
        )}
      </SSVStack>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: 40,
    height: 80,
    width: 80
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: Colors.gray[800],
    justifyContent: 'center'
  },
  container: {
    paddingBottom: 12,
    paddingTop: 8
  },
  metaBlock: {
    width: '100%'
  },
  metaPlaceholder: {
    opacity: 0.55
  },
  relayTagChecking: {
    opacity: 0.75
  },
  relayTagConnected: {
    color: Colors.mainGreen
  }
})

export default SSNostrHeroCard
