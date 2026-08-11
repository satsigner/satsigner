import { FlashList } from '@shopify/flash-list'
import { StyleSheet, View } from 'react-native'

import SSNostrAccountCard from '@/components/SSNostrAccountCard'
import {
  NOSTR_LIST_ITEM_GAP,
  NOSTR_LIST_PADDING_VERTICAL
} from '@/constants/nostr'
import { type NostrContactItem } from '@/types/models/Nostr'
import { contactToIdentity } from '@/utils/nostrContacts'

type SSNostrContactListProps = {
  contacts: NostrContactItem[]
  onPress: (item: NostrContactItem) => void
}

function NostrContactListSeparator() {
  return <View style={styles.separator} />
}

type NostrContactRowProps = {
  item: NostrContactItem
  onPress: (item: NostrContactItem) => void
}

function NostrContactRow({ item, onPress }: NostrContactRowProps) {
  function handlePress() {
    onPress(item)
  }

  return (
    <SSNostrAccountCard
      identity={contactToIdentity(item)}
      onPress={handlePress}
    />
  )
}

function SSNostrContactList({ contacts, onPress }: SSNostrContactListProps) {
  function renderItem({ item }: { item: NostrContactItem }) {
    return <NostrContactRow item={item} onPress={onPress} />
  }

  function keyExtractor(item: NostrContactItem) {
    return item.pubkey
  }

  return (
    <View style={styles.list}>
      <FlashList
        data={contacts}
        ItemSeparatorComponent={NostrContactListSeparator}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    paddingVertical: NOSTR_LIST_PADDING_VERTICAL,
    width: '100%'
  },
  separator: {
    height: NOSTR_LIST_ITEM_GAP
  }
})

export default SSNostrContactList
