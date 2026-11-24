import type { FlashListRef } from '@shopify/flash-list'
import { useRef, useState } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'

import { NOSTR_GROUP_CHAT_SCROLL_THRESHOLD } from '@/constants/nostr'

const SCROLL_TO_MESSAGE_VIEW_POSITION = 0.5

/** Start at the newest message; following new ones is handled below. */
const CHAT_VISIBLE_CONTENT_POSITION = { startRenderingFromBottom: true }

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
 *
 * The list follows new content only while it rests at the bottom and the
 * user isn't touching it. FlashList's own autoscrollToBottomThreshold isn't
 * used: its "near the bottom" flag only updates on its bound checks, so a
 * row measured while the user starts scrolling up snapped the list back.
 */
function useNostrChatScroll<T>(newestId: string | undefined) {
  const listRef = useRef<FlashListRef<T>>(null)
  const atBottomRef = useRef(true)
  const interactingRef = useRef(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [seenNewestId, setSeenNewestId] = useState<string>()

  const showNewMessages =
    !isAtBottom && seenNewestId !== undefined && newestId !== seenNewestId

  function handleListScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const atBottom = isScrolledToBottom(event.nativeEvent)
    atBottomRef.current = atBottom
    if (atBottom === isAtBottom) {
      return
    }
    setIsAtBottom(atBottom)
    if (!atBottom) {
      setSeenNewestId(newestId)
    }
  }

  function handleInteractionStart() {
    interactingRef.current = true
  }

  function handleInteractionEnd() {
    interactingRef.current = false
  }

  /** New or re-measured rows keep the list at the bottom if it was there. */
  function handleContentSizeChange() {
    if (!atBottomRef.current || interactingRef.current) {
      return
    }
    listRef.current?.scrollToEnd({ animated: false })
  }

  function scrollToBottom() {
    atBottomRef.current = true
    listRef.current?.scrollToEnd({ animated: true })
    setIsAtBottom(true)
  }

  function scrollToIndex(index: number) {
    atBottomRef.current = false
    listRef.current?.scrollToIndex({
      animated: true,
      index,
      viewPosition: SCROLL_TO_MESSAGE_VIEW_POSITION
    })
  }

  return {
    listRef,
    scrollHandlers: {
      onContentSizeChange: handleContentSizeChange,
      onMomentumScrollBegin: handleInteractionStart,
      onMomentumScrollEnd: handleInteractionEnd,
      onScroll: handleListScroll,
      onScrollBeginDrag: handleInteractionStart,
      onScrollEndDrag: handleInteractionEnd
    },
    scrollToBottom,
    scrollToIndex,
    showNewMessages
  }
}

export { CHAT_VISIBLE_CONTENT_POSITION, useNostrChatScroll }
