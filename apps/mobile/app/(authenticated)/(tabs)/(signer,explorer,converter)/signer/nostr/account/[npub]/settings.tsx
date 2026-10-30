import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

import {
  SSIconCalendar,
  SSIconChatBubble,
  SSIconContacts,
  SSIconFiles
} from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSPressable from '@/components/SSPressable'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { Colors } from '@/styles'
import { nostrAccountHref, nostrIndexHref } from '@/utils/nostrNavigation'

type SettingsParams = {
  npub: string
}

const CHICLET_COUNT = 4
const CHICLET_TOP_EDGE = [
  'rgba(255,255,255,0.05)',
  'rgba(255,255,255,0.18)',
  'rgba(255,255,255,0.05)'
] as const

export default function NostrIdentitySettings() {
  const router = useRouter()
  const { npub } = useLocalSearchParams<SettingsParams>()

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const removeIdentity = useNostrIdentityStore((state) => state.removeIdentity)

  const [deleteModalVisible, setDeleteModalVisible] = useState(false)

  function handleConfirmDelete() {
    setDeleteModalVisible(false)
    removeIdentity(npub)
    router.navigate(nostrIndexHref())
  }

  if (!identity) {
    return (
      <SSMainLayout>
        <SSVStack itemsCenter gap="lg" style={styles.emptyContainer}>
          <SSText color="muted">{t('nostrIdentity.account.notFound')}</SSText>
        </SSVStack>
      </SSMainLayout>
    )
  }

  const menuItems = [
    {
      label: t('nostrIdentity.settings.profile'),
      onPress: () => router.navigate(nostrAccountHref(npub, 'profile'))
    },
    {
      label: t('nostrIdentity.settings.keys'),
      onPress: () => router.navigate(nostrAccountHref(npub, 'keys'))
    },
    {
      label: t('nostrIdentity.settings.relays'),
      onPress: () => router.navigate(nostrAccountHref(npub, 'relays'))
    },
    {
      label: t('nostrIdentity.settings.blossom'),
      onPress: () => router.navigate(nostrAccountHref(npub, 'blossom'))
    },
    {
      label: t('nostrIdentity.settings.zaps'),
      onPress: () => router.navigate(nostrAccountHref(npub, 'zapSettings'))
    },
    ...(!identity.isWatchOnly
      ? [
          {
            label: t('nostrIdentity.settings.signer'),
            onPress: () => router.navigate(nostrAccountHref(npub, 'bunker'))
          }
        ]
      : []),
    {
      label: t('nostrIdentity.settings.cache.title'),
      onPress: () => router.navigate(nostrAccountHref(npub, 'cache'))
    }
  ]

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>
              {identity.displayName ?? `${npub.slice(0, 12)}…`}
            </SSText>
          )
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SSVStack gap="md" style={styles.content}>
          <SSHStack gap="md">
            <Chiclet
              index={0}
              label={t('nostrIdentity.chat.title')}
              onPress={() => router.navigate(nostrAccountHref(npub, 'chat'))}
            >
              <SSIconChatBubble color={Colors.white} height={24} width={24} />
            </Chiclet>
            <Chiclet
              index={1}
              label={t('nostrIdentity.contacts.title')}
              onPress={() =>
                router.navigate(nostrAccountHref(npub, 'contacts'))
              }
            >
              <SSIconContacts color={Colors.white} height={24} width={24} />
            </Chiclet>
            <Chiclet
              index={2}
              label={t('nostrIdentity.calendar.title')}
              onPress={() =>
                router.navigate(nostrAccountHref(npub, 'calendar'))
              }
            >
              <SSIconCalendar color={Colors.white} height={24} width={24} />
            </Chiclet>
            <Chiclet
              index={3}
              label={t('nostrIdentity.files.title')}
              onPress={() => router.navigate(nostrAccountHref(npub, 'files'))}
            >
              <SSIconFiles color={Colors.white} height={24} width={24} />
            </Chiclet>
          </SSHStack>

          <SSVStack gap="md" widthFull>
            {menuItems.map((item, index) => (
              <SSButton
                key={item.label}
                label={item.label}
                variant="subtle"
                verticalIndex={index}
                totalButtonsVertical={menuItems.length}
                onPress={item.onPress}
              />
            ))}

            <SSButton
              label={t('nostrIdentity.settings.deleteIdentity')}
              variant="danger"
              onPress={() => setDeleteModalVisible(true)}
            />
          </SSVStack>
        </SSVStack>
      </ScrollView>

      <SSModal
        visible={deleteModalVisible}
        fullOpacity
        label={t('common.cancel')}
        onClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.deleteSheet}>
          <SSVStack gap="md" itemsCenter widthFull>
            <SSVStack gap="sm" itemsCenter widthFull>
              <SSText center size="sm" color="muted" uppercase>
                {t('nostrIdentity.settings.deleteModalTitle')}
              </SSText>
              <SSText center color="muted" size="sm">
                {t('nostrIdentity.settings.deleteConfirm')}
              </SSText>
            </SSVStack>
            <SSButton
              label={t('common.delete')}
              variant="danger"
              onPress={handleConfirmDelete}
            />
          </SSVStack>
        </View>
      </SSModal>
    </SSMainLayout>
  )
}

type ChicletProps = {
  children: React.ReactNode
  index: number
  label: string
  onPress: () => void
}

function Chiclet({ children, index, label, onPress }: ChicletProps) {
  return (
    <SSPressable
      accessibilityLabel={label}
      style={styles.chiclet}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.chicletTile}>
        <LinearGradient
          colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.025)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          style={[styles.glassBorder, styles.glassBorderTop]}
          colors={CHICLET_TOP_EDGE}
          locations={[0, 0.42, 1]}
          start={{ x: -index, y: 0 }}
          end={{ x: CHICLET_COUNT - index, y: 0 }}
        />
        <View style={styles.chicletContent}>{children}</View>
      </View>
    </SSPressable>
  )
}

const styles = StyleSheet.create({
  chiclet: {
    flex: 1
  },
  chicletContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  },
  chicletTile: {
    aspectRatio: 1,
    backgroundColor: Colors.gray[900],
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%'
  },
  content: {
    paddingBottom: 40
  },
  deleteSheet: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 0,
    width: '100%'
  },
  emptyContainer: {
    paddingVertical: 60
  },
  glassBorder: {
    position: 'absolute'
  },
  glassBorderTop: {
    height: 1,
    left: 0,
    right: 0,
    top: 0
  }
})
