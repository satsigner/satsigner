import { type FlashListRef } from '@shopify/flash-list'
import { useRef, useState } from 'react'
import { type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'

import { NOSTR_GROUP_CHAT_SCROLL_THRESHOLD } from '@/constants/nostr'

const SCROLL_TO_MESSAGE_VIEW_POSITION = 0.5

function isScrolledToBottom({
  contentOffset,
  contentSize,
  layoutMeasurement
}: NativeScrollEvent): boolean {
  return (
    contentOffset.y + layoutMeasurement.height >=
    contentSize.height - NOSTR_GROUP_CHAT_SCROLL_THRESHOLD
  )
}

/**
 * Bottom-anchored chat list state: whether the newest message arrived while
 * the user was scrolled up (shows the "new messages" pill), and scrolling to
 * the bottom or to a given row.
 */
function useNostrChatScroll<T>(newestId: string | undefined) {
  const listRef = useRef<FlashListRef<T>>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [seenNewestId, setSeenNewestId] = useState<string>()

  const showNewMessages =
    !isAtBottom && seenNewestId !== undefined && newestId !== seenNewestId

  function handleListScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const atBottom = isScrolledToBottom(event.nativeEvent)
    if (atBottom === isAtBottom) {
      return
    }
    setIsAtBottom(atBottom)
    if (!atBottom) {
      setSeenNewestId(newestId)
    }
  }

  function scrollToBottom() {
    listRef.current?.scrollToEnd({ animated: true })
    setIsAtBottom(true)
  }

  function scrollToIndex(index: number) {
    listRef.current?.scrollToIndex({
      animated: true,
      index,
      viewPosition: SCROLL_TO_MESSAGE_VIEW_POSITION
    })
  }

  return {
    handleListScroll,
    listRef,
    scrollToBottom,
    scrollToIndex,
    showNewMessages
  }
}

export { useNostrChatScroll }
