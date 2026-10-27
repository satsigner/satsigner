import { FlashList } from '@shopify/flash-list'
import { type ReactElement } from 'react'
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSText from '@/components/SSText'
import SSZapAmountDisplay from '@/components/SSZapAmountDisplay'
import {
  NOSTR_FEED_END_REACHED_THRESHOLD,
  NOSTR_PRIVACY_MASK
} from '@/constants/nostr'
import { useNostrVisibleItemsTrack } from '@/hooks/useNostrVisibleItemsTrack'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { pickNostrProfiles, useNostrProfilesStore } from '@/store/nostrProfiles'
import { Colors, Layout } from '@/styles'
import type { ZapReceiptInfo } from '@/types/models/Nostr'
import { formatNostrCardDate } from '@/utils/format'
import { applyZapProfiles, getZapCounterpartyDisplay } from '@/utils/nostrZap'

import SSPressable from './SSPressable'

type ZapListRowProps = {
  onZapPress?: (receipt: ZapReceiptInfo) => void
  privacyMode: boolean
  receipt: ZapReceiptInfo
}

type SSNostrZapListProps = {
  fetchNextPage: () => void
  hasNextPage: boolean
  header: ReactElement
  isFetchingNextPage: boolean
  isLoading: boolean
  onZapPress?: (receipt: ZapReceiptInfo) => void
  privacyMode: boolean
  relays: string[]
  zaps: ZapReceiptInfo[]
}

function getZapPubkeys(receipt: ZapReceiptInfo): string[] {
  return receipt.recipientPubkey
    ? [receipt.senderPubkey, receipt.recipientPubkey]
    : [receipt.senderPubkey]
}

function ZapListRow({ onZapPress, privacyMode, receipt }: ZapListRowProps) {
  const profiles = useNostrProfilesStore(
    useShallow((state) =>
      pickNostrProfiles(state.profiles, getZapPubkeys(receipt))
    )
  )
  const enriched = applyZapProfiles(
    receipt,
    (pubkey) => profiles[pubkey.toLowerCase()]
  )
  const isOutgoing = enriched.direction === 'outgoing'
  const { avatarUri, displayName, initial } =
    getZapCounterpartyDisplay(enriched)

  function handlePress() {
    onZapPress?.(enriched)
  }

  const row = (
    <SSHStack gap="sm" style={styles.zapRow}>
      {privacyMode || !avatarUri ? (
        <View style={[styles.zapAvatar, styles.zapAvatarPlaceholder]}>
          {privacyMode ? null : (
            <SSText size="xs" weight="bold">
              {initial}
            </SSText>
          )}
        </View>
      ) : (
        <Image source={{ uri: avatarUri }} style={styles.zapAvatar} />
      )}
      <SSVStack gap="xxs" style={styles.zapInfo}>
        {isOutgoing ? (
          <SSText size="xxs" color="muted" uppercase>
            {t('nostrIdentity.feed.outgoingZap')}
          </SSText>
        ) : null}
        <SSText size="sm" weight="medium">
          {privacyMode ? NOSTR_PRIVACY_MASK : displayName}
        </SSText>
        {!privacyMode && enriched.comment ? (
          <SSText size="xs" color="muted" numberOfLines={2}>
            {enriched.comment}
          </SSText>
        ) : null}
      </SSVStack>
      <SSVStack gap="xxs" style={styles.zapAmountCol}>
        <SSText size="xxs" color="muted">
          {formatNostrCardDate(enriched.createdAt)}
        </SSText>
        <SSZapAmountDisplay
          amountSats={enriched.amountSats}
          incoming={!isOutgoing}
        />
      </SSVStack>
    </SSHStack>
  )

  if (!onZapPress) {
    return <View style={styles.rowPadding}>{row}</View>
  }

  return (
    <SSPressable
      accessibilityRole="button"
      activeOpacity={0.7}
      onPress={handlePress}
      style={styles.rowPadding}
    >
      {row}
    </SSPressable>
  )
}

function keyExtractor(item: ZapReceiptInfo) {
  return item.id
}

/** Zap receipts as a FlashList; sender/recipient profiles load per window. */
function SSNostrZapList({
  fetchNextPage,
  hasNextPage,
  header,
  isFetchingNextPage,
  isLoading,
  onZapPress,
  privacyMode,
  relays,
  zaps
}: SSNostrZapListProps) {
  const { onViewableItemsChanged } = useNostrVisibleItemsTrack({
    enabled: !privacyMode,
    getPubkeys: getZapPubkeys,
    items: zaps,
    relays
  })

  function handleEndReached() {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }

  function renderItem({ item }: { item: ZapReceiptInfo }) {
    return (
      <ZapListRow
        onZapPress={onZapPress}
        privacyMode={privacyMode}
        receipt={item}
      />
    )
  }

  const showSpinner = isLoading || isFetchingNextPage

  return (
    <FlashList
      data={zaps}
      keyExtractor={keyExtractor}
      ListEmptyComponent={
        showSpinner ? null : (
          <SSText size="xs" color="muted" center style={styles.emptyText}>
            {t('nostrIdentity.feed.noZaps')}
          </SSText>
        )
      }
      ListFooterComponent={
        showSpinner ? (
          <ActivityIndicator
            color={Colors.white}
            size="small"
            style={styles.loader}
          />
        ) : null
      }
      ListHeaderComponent={header}
      onEndReached={handleEndReached}
      onEndReachedThreshold={NOSTR_FEED_END_REACHED_THRESHOLD}
      onViewableItemsChanged={onViewableItemsChanged}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
    />
  )
}

const styles = StyleSheet.create({
  emptyText: {
    paddingVertical: 24
  },
  loader: {
    paddingVertical: 16
  },
  rowPadding: {
    paddingHorizontal: Layout.mainContainer.paddingHorizontal
  },
  zapAmountCol: {
    alignItems: 'flex-end'
  },
  zapAvatar: {
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    borderWidth: 1.5,
    height: 32,
    width: 32
  },
  zapAvatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: Colors.gray[800],
    justifyContent: 'center'
  },
  zapInfo: {
    flex: 1
  },
  zapRow: {
    alignItems: 'center',
    borderBottomColor: Colors.gray[800],
    borderBottomWidth: 1,
    paddingBottom: 16,
    paddingTop: 8
  }
})

export default SSNostrZapList
