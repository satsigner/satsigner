import { useQuery } from '@tanstack/react-query'
import { LinearGradient } from 'expo-linear-gradient'
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native'

import SSIconCheckCircleThin from '@/components/icons/SSIconCheckCircleThin'
import SSIconCircleXThin from '@/components/icons/SSIconCircleXThin'
import SSText from '@/components/SSText'
import { NOSTR_PRIVACY_MASK } from '@/constants/nostr'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { useSettingsStore } from '@/store/settings'
import { Colors, Sizes } from '@/styles'
import {
  type NostrIdentity,
  type NostrRelayConnectionInfo
} from '@/types/models/NostrIdentity'
import {
  generateColorFromNpub,
  getPubKeyHexFromNpub,
  validateNip05
} from '@/utils/nostr'
import { truncateNpub } from '@/utils/nostrIdentity'

import { SSIconChevronRight } from './icons'

const ACTIVE_CARD_GRADIENT_BOTTOM = Colors.gray[925] // eslint-disable-line prefer-destructuring
const ACTIVE_CARD_GRADIENT_TOP = Colors.gray[875] // eslint-disable-line prefer-destructuring
/** Horizontal span (0–1) for unit vertical run so gradient is ~5° from vertical. */
const ACTIVE_GRADIENT_TAN_5_DEG = Math.tan((5 * Math.PI) / 180)

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

type SSNostrAccountCardProps = {
  identity: NostrIdentity
  onPress: () => void
  isActive?: boolean
  connectionInfo?: NostrRelayConnectionInfo
}

function SSNostrAccountCard({
  identity,
  onPress,
  isActive,
  connectionInfo
}: SSNostrAccountCardProps) {
  const privacyMode = useSettingsStore((state) => state.privacyMode)
  const storeRelays = useNostrIdentityStore((state) => state.relays)
  const urls = identity.relays?.length ? identity.relays : storeRelays
  const relayCount = urls.length

  const nip05Value = identity.nip05?.trim()
  const lud16Value = identity.lud16?.trim()
  const npubColor = generateColorFromNpub(identity.npub)
  const pubkeyHex = getPubKeyHexFromNpub(identity.npub)

  const { data: nip05Valid } = useQuery({
    enabled: !!pubkeyHex && !!nip05Value,
    queryFn: () => validateNip05(pubkeyHex!, nip05Value!),
    queryKey: ['nostr', 'nip05-valid', identity.npub, nip05Value],
    staleTime: 5 * 60_000
  })

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      style={[styles.container, isActive && styles.containerActive]}
    >
      {isActive ? (
        <LinearGradient
          colors={[ACTIVE_CARD_GRADIENT_TOP, ACTIVE_CARD_GRADIENT_BOTTOM]}
          end={{
            x: 0.5 + ACTIVE_GRADIENT_TAN_5_DEG / 2,
            y: 1
          }}
          pointerEvents="none"
          start={{
            x: 0.5 - ACTIVE_GRADIENT_TAN_5_DEG / 2,
            y: 0
          }}
          style={[StyleSheet.absoluteFillObject, styles.activeGradientFill]}
        />
      ) : null}
      {isActive ? (
        <LinearGradient
          colors={[
            'rgba(255, 255, 255, 0.03)',
            'rgba(255, 255, 255, 0)',
            'rgba(255, 255, 255, 0.012)'
          ]}
          end={{ x: 0.8, y: 0.4 }}
          locations={[0, 0.55, 1]}
          pointerEvents="none"
          start={{ x: 0.14, y: 0 }}
          style={[StyleSheet.absoluteFillObject, styles.activeGlassSheen]}
        />
      ) : null}
      {isActive ? (
        <View pointerEvents="none" style={styles.activeGlassInnerStroke} />
      ) : null}
      {isActive ? (
        <View pointerEvents="none" style={styles.activeHeaderBadges}>
          <View style={styles.activeHeaderBadgesRow}>
            {connectionInfo ? (
              <SSText
                color="muted"
                numberOfLines={1}
                size="xxs"
                style={
                  connectionInfo.status === 'connected'
                    ? styles.relayBesideActiveConnected
                    : connectionInfo.status === 'checking'
                      ? styles.relayBesideActiveChecking
                      : styles.relayBesideActiveDisconnected
                }
                weight="medium"
              >
                {connectionInfo.status === 'checking'
                  ? t('nostrIdentity.account.relayChecking')
                  : connectionInfo.status === 'connected'
                    ? t('nostrIdentity.account.relayConnected')
                    : disconnectReasonLabel(connectionInfo.reason)}
              </SSText>
            ) : null}
            <View style={styles.activeBadge}>
              <SSText color="muted" size="xxs" uppercase weight="medium">
                {t('nostrIdentity.account.activeTag')}
              </SSText>
            </View>
          </View>
        </View>
      ) : null}
      <SSHStack justifyBetween style={styles.headerRow}>
        <SSHStack gap="md" style={styles.contentRow}>
          <View style={styles.avatarContainer}>
            {privacyMode ? (
              <View
                style={[
                  styles.avatar,
                  styles.avatarPlaceholder,
                  isActive && styles.avatarActiveRing
                ]}
              />
            ) : identity.picture ? (
              <Image
                source={{ uri: identity.picture }}
                style={[styles.avatar, isActive && styles.avatarActiveRing]}
              />
            ) : (
              <View
                style={[
                  styles.avatar,
                  styles.avatarPlaceholder,
                  isActive && styles.avatarActiveRing
                ]}
              >
                <SSText color="white" size="md" weight="bold">
                  {(identity.displayName ??
                    identity.npub)?.[0]?.toUpperCase() ?? 'N'}
                </SSText>
              </View>
            )}
          </View>
          <SSVStack gap="xxs" style={styles.infoContainer}>
            <SSText color="white" size="md" weight="medium" numberOfLines={1}>
              {privacyMode
                ? NOSTR_PRIVACY_MASK
                : identity.displayName || 'Unnamed'}
            </SSText>
            <SSHStack gap="xs" style={{ alignItems: 'center' }}>
              <View
                style={[styles.npubColorDot, { backgroundColor: npubColor }]}
              />
              <SSText size="xs" type="mono" color="muted" numberOfLines={1}>
                {truncateNpub(identity.npub)}
              </SSText>
            </SSHStack>
            <View style={styles.reservedMetaRow}>
              <SSText
                size="xs"
                color={privacyMode ? 'muted' : lud16Value ? 'white' : 'muted'}
                numberOfLines={1}
                style={
                  !privacyMode && !lud16Value
                    ? styles.metaPlaceholder
                    : undefined
                }
              >
                {privacyMode
                  ? NOSTR_PRIVACY_MASK
                  : lud16Value || t('nostrIdentity.account.lud16NotSet')}
              </SSText>
            </View>
            <SSHStack justifyBetween gap="sm" style={styles.nip05Row}>
              <View style={styles.nip05TextWrap}>
                <SSHStack gap="xs" style={{ alignItems: 'center' }}>
                  <SSText
                    size="xs"
                    color="muted"
                    numberOfLines={1}
                    style={
                      !privacyMode && !nip05Value
                        ? styles.metaPlaceholder
                        : undefined
                    }
                  >
                    {privacyMode
                      ? NOSTR_PRIVACY_MASK
                      : nip05Value || t('nostrIdentity.account.nip05NotSet')}
                  </SSText>
                  {!privacyMode && nip05Value && nip05Valid === true && (
                    <SSIconCheckCircleThin width={10} height={10} />
                  )}
                  {!privacyMode && nip05Value && nip05Valid === false && (
                    <SSIconCircleXThin width={10} height={10} />
                  )}
                </SSHStack>
              </View>
              <View style={styles.relayTotalWrap}>
                <SSText
                  accessibilityLabel={t(
                    'nostrIdentity.account.relayTotalA11y',
                    {
                      count: relayCount
                    }
                  )}
                  accessibilityRole="text"
                  color="muted"
                  numberOfLines={1}
                  size="xxs"
                  style={[
                    styles.relayTotalInline,
                    isActive && styles.relayTotalInlineActiveCard
                  ]}
                >
                  {t('nostrIdentity.account.relayTotal', { count: relayCount })}
                </SSText>
              </View>
            </SSHStack>
            <View style={styles.reservedMetaRow}>
              {identity.isWatchOnly ? (
                <SSText size="xs" color="muted" uppercase>
                  watch only
                </SSText>
              ) : null}
            </View>
          </SSVStack>
        </SSHStack>
        <View style={styles.chevronWrap}>
          <View style={styles.chevronOptical}>
            <SSIconChevronRight height={11.6} width={6} />
          </View>
        </View>
      </SSHStack>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  activeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    paddingVertical: 3
  },
  activeGlassInnerStroke: {
    borderColor: 'rgba(255, 255, 255, 0.045)',
    borderRadius: Sizes.button.borderRadius - 1,
    borderWidth: StyleSheet.hairlineWidth,
    bottom: 1,
    left: 1,
    pointerEvents: 'none',
    position: 'absolute',
    right: 1,
    top: 1,
    zIndex: 2
  },
  activeGlassSheen: {
    borderRadius: Sizes.button.borderRadius,
    zIndex: 1
  },
  activeGradientFill: {
    borderRadius: Sizes.button.borderRadius
  },
  activeHeaderBadges: {
    left: 14,
    position: 'absolute',
    right: 14,
    top: 10,
    zIndex: 4
  },
  activeHeaderBadgesRow: {
    alignItems: 'center',
    columnGap: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end'
  },
  avatar: {
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    width: 36
  },
  avatarActiveRing: {
    borderColor: 'rgba(255, 255, 255, 0.09)'
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
  chevronOptical: {
    transform: [{ translateY: -5 }]
  },
  chevronWrap: {
    justifyContent: 'center'
  },
  container: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: Sizes.button.borderRadius,
    borderTopWidth: 1,
    overflow: 'hidden',
    paddingBottom: 0,
    paddingHorizontal: 14,
    paddingTop: 14,
    position: 'relative'
  },
  containerActive: {
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderTopWidth: 1,
    borderWidth: 1,
    shadowColor: '#FFFFFF',
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 14
  },
  contentRow: {
    alignItems: 'flex-start',
    flex: 1
  },
  headerRow: {
    alignItems: 'stretch',
    position: 'relative',
    zIndex: 3
  },
  infoContainer: {
    flex: 1
  },
  metaPlaceholder: {
    opacity: 0.55
  },
  nip05Row: {
    alignItems: 'center',
    marginEnd: -16,
    minHeight: 14
  },
  nip05TextWrap: {
    flex: 1,
    minWidth: 0
  },
  npubColorDot: {
    borderRadius: 3,
    height: 6,
    width: 6
  },
  relayBesideActiveChecking: {
    opacity: 0.72
  },
  relayBesideActiveConnected: {
    color: Colors.mainGreen
  },
  relayBesideActiveDisconnected: {
    opacity: 0.55
  },
  relayTotalInline: {
    opacity: 0.52
  },
  relayTotalInlineActiveCard: {
    opacity: 0.36
  },
  relayTotalWrap: {
    flexShrink: 0
  },
  reservedMetaRow: {
    justifyContent: 'center',
    minHeight: 14
  }
})

export default SSNostrAccountCard
