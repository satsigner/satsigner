import {
  NOSTR_VIDEO_FAILURE_COOLDOWN_MS,
  NOSTR_VIDEO_MAX_PLAYERS
} from '@/constants/nostr'
import {
  isVideoCoolingDown,
  pickActiveVideoUrl,
  useNostrVideoStore
} from '@/store/nostrVideo'

const URLS = Array.from(
  { length: NOSTR_VIDEO_MAX_PLAYERS + 2 },
  (_, index) => `https://media.example/${index}.mp4`
)

describe('nostr video store', () => {
  beforeEach(() => {
    useNostrVideoStore.setState({
      activeUrl: null,
      failedUntil: {},
      loadedUrls: []
    })
  })

  it('keeps at most the max number of players, newest first', () => {
    for (const url of URLS) {
      useNostrVideoStore.getState().loadVideo(url)
    }
    const { activeUrl, loadedUrls } = useNostrVideoStore.getState()

    expect(loadedUrls).toHaveLength(NOSTR_VIDEO_MAX_PLAYERS)
    expect(loadedUrls[0]).toBe(URLS.at(-1))
    expect(activeUrl).toBe(URLS.at(-1))
  })

  it('unloads a failed video and cools it down', () => {
    const [url = ''] = URLS
    const now = 1_000_000
    useNostrVideoStore.getState().loadVideo(url)
    useNostrVideoStore.getState().markVideoFailed(url, now)
    const { activeUrl, failedUntil, loadedUrls } = useNostrVideoStore.getState()

    expect(loadedUrls).not.toContain(url)
    expect(activeUrl).toBeNull()
    expect(isVideoCoolingDown(failedUntil, url, now + 1)).toBe(true)
    expect(
      isVideoCoolingDown(
        failedUntil,
        url,
        now + NOSTR_VIDEO_FAILURE_COOLDOWN_MS + 1
      )
    ).toBe(false)
  })

  it('only autoplays videos the user already loaded', () => {
    const [first = '', second = '', third = ''] = URLS

    expect(pickActiveVideoUrl([first, second], [second, third])).toBe(second)
    expect(pickActiveVideoUrl([first], [third])).toBeNull()
  })

  it('releases every player when the app goes to background', () => {
    useNostrVideoStore.getState().loadVideo(URLS[0] ?? '')
    useNostrVideoStore.getState().releaseAllVideos()

    expect(useNostrVideoStore.getState().loadedUrls).toStrictEqual([])
    expect(useNostrVideoStore.getState().activeUrl).toBeNull()
  })
})
