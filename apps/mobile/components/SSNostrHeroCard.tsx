import { Image, StyleSheet, View } from 'react-native'

import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'
import { type NostrIdentity } from '@/types/models/NostrIdentity'
import { truncateNpub } from '@/utils/nostrIdentity'

type SSNostrHeroCardProps = {
  identity: NostrIdentity
}

function SSNostrHeroCard({ identity }: SSNostrHeroCardProps) {
  return (
    <SSVStack itemsCenter gap="sm" style={styles.container}>
      <View style={styles.avatarContainer}>
        {identity.picture ? (
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
      <SSText size="xl" weight="medium">
        {identity.displayName || 'Unnamed'}
      </SSText>
      <SSClipboardCopy text={identity.npub}>
        <SSText size="xs" type="mono" color="muted">
          {truncateNpub(identity.npub, 12)}
        </SSText>
      </SSClipboardCopy>
      {identity.nip05 && (
        <SSClipboardCopy text={identity.nip05}>
          <SSText size="sm" color="muted">
            {identity.nip05}
          </SSText>
        </SSClipboardCopy>
      )}
      {identity.lud16 && (
        <SSClipboardCopy text={identity.lud16}>
          <SSText size="sm" style={{ color: Colors.mainGreen }}>
            {identity.lud16}
          </SSText>
        </SSClipboardCopy>
      )}
      {identity.isWatchOnly && (
        <SSText size="xs" color="muted" uppercase>
          watch only
        </SSText>
      )}
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
    paddingBottom: 16,
    paddingTop: 8
  }
})

export default SSNostrHeroCard
