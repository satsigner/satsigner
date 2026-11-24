import { createElement } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { act, create } from 'react-test-renderer'

import { useNostrChatScroll } from '@/hooks/useNostrChatScroll'

const VIEWPORT = 600
const CONTENT = 3000

function scrollEvent(offsetY: number): NativeSyntheticEvent<NativeScrollEvent> {
  const nativeEvent: NativeScrollEvent = {
    contentInset: { bottom: 0, left: 0, right: 0, top: 0 },
    contentOffset: { x: 0, y: offsetY },
    contentSize: { height: CONTENT, width: 300 },
    layoutMeasurement: { height: VIEWPORT, width: 300 },
    zoomScale: 1
  }
  return {
    bubbles: false,
    cancelable: false,
    currentTarget: 0,
    defaultPrevented: false,
    eventPhase: 0,
    isDefaultPrevented: () => false,
    isPropagationStopped: () => false,
    isTrusted: true,
    nativeEvent,
    persist: () => undefined,
    preventDefault: () => undefined,
    stopPropagation: () => undefined,
    target: 0,
    timeStamp: 0,
    type: 'scroll'
  }
}

const AT_BOTTOM = CONTENT - VIEWPORT
const SCROLLED_UP = 400

function renderScroll() {
  const result: { current?: ReturnType<typeof useNostrChatScroll<string>> } =
    {}
  function Probe() {
    result.current = useNostrChatScroll<string>('newest')
    return null
  }
  act(() => {
    create(createElement(Probe))
  })
  const scrollToEnd = jest.fn()
  if (result.current) {
    Object.assign(result.current.listRef, { current: { scrollToEnd } })
  }
  return { result, scrollToEnd }
}

describe('useNostrChatScroll', () => {
  it('follows new content while resting at the bottom', () => {
    const { result, scrollToEnd } = renderScroll()

    act(() => {
      result.current?.scrollHandlers.onScroll(scrollEvent(AT_BOTTOM))
    })
    result.current?.scrollHandlers.onContentSizeChange()

    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false })
  })

  it('stays put when the user scrolled up to read older messages', () => {
    const { result, scrollToEnd } = renderScroll()

    act(() => {
      result.current?.scrollHandlers.onScroll(scrollEvent(SCROLLED_UP))
    })
    result.current?.scrollHandlers.onContentSizeChange()

    expect(scrollToEnd).not.toHaveBeenCalled()
  })

  it('never pulls the list down while the user is dragging', () => {
    const { result, scrollToEnd } = renderScroll()

    act(() => {
      result.current?.scrollHandlers.onScroll(scrollEvent(AT_BOTTOM))
    })
    result.current?.scrollHandlers.onScrollBeginDrag()
    result.current?.scrollHandlers.onContentSizeChange()

    expect(scrollToEnd).not.toHaveBeenCalled()
  })

  it('stops following after jumping to an older message', () => {
    const { result, scrollToEnd } = renderScroll()
    Object.assign(result.current?.listRef ?? {}, {
      current: { scrollToEnd, scrollToIndex: jest.fn() }
    })

    result.current?.scrollToIndex(3)
    result.current?.scrollHandlers.onContentSizeChange()

    expect(scrollToEnd).not.toHaveBeenCalled()
  })
})
