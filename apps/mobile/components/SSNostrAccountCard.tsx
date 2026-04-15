import { Image, StyleSheet, TouchableOpacity, View } from 'react-native'

import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'
import { type NostrIdentity } from '@/types/models/NostrIdentity'
import { truncateNpub } from '@/utils/nostrIdentity'

import { SSIconChevronRight } from './icons'

type SSNostrAccountCardProps = {
  identity: NostrIdentity
  onPress: () => void
  isActive?: boolean
}

function SSNostrAccountCard({
  identity,
  onPress,
  isActive
}: SSNostrAccountCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.5}
      onPress={onPress}
      style={[styles.container, isActive && styles.activeContainer]}
    >
      <SSHStack justifyBetween>
        <SSHStack gap="md" style={styles.contentRow}>
          <View style={styles.avatarContainer}>
            {identity.picture ? (
              <Image
                source={{ uri: identity.picture }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <SSText size="lg" weight="bold">
                  {(identity.displayName ?? identity.npub)?.[0]?.toUpperCase() ??
                    'N'}
                </SSText>
              </View>
            )}
          </View>
          <SSVStack gap="xxs" style={styles.infoContainer}>
            <SSText size="md" weight="medium">
              {identity.displayName || 'Unnamed'}
            </SSText>
            <SSText size="xs" type="mono" color="muted">
              {truncateNpub(identity.npub)}
            </SSText>
            {identity.nip05 && (
              <SSText size="xs" color="muted">
                {identity.nip05}
              </SSText>
            )}
            {identity.lud16 && (
              <SSText size="xs" style={{ color: Colors.mainGreen }}>
                {identity.lud16}
              </SSText>
            )}
            {identity.isWatchOnly && (
              <SSText size="xs" color="muted" uppercase>
                watch only
              </SSText>
            )}
          </SSVStack>
        </SSHStack>
        <SSIconChevronRight height={11.6} width={6} />
      </SSHStack>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  activeContainer: {
    borderColor: Colors.mainGreen,
    borderWidth: 1
  },
  avatar: {
    borderRadius: 20,
    height: 40,
    width: 40
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
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 8,
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  contentRow: {
    flex: 1
  },
  infoContainer: {
    flex: 1
  }
})

export default SSNostrAccountCard
