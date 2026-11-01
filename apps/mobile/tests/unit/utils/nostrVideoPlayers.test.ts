import { useNostrVideoStore } from '@/store/nostrVideo'
import {
  registeredVideoPlayerCount,
  registerVideoPlayer,
  syncPlayers
} from '@/utils/nostrVideoPlayers'

jest.mock<typeof import('@/utils/nostrLifecycle')>(
  '@/utils/nostrLifecycle',
  () => ({ registerNostrLifecycleHandler: jest.fn() })
)

const URL_A = 'https://media.example/a.mp4'
const URL_B = 'https://media.example/b.mp4'

function createPlayer() {
  return { loop: false, muted: false, pause: jest.fn(), play: jest.fn() }
}

function releasePlayer(player: ReturnType<typeof createPlayer>) {
  const released = () => {
    throw new Error('Cannot use shared object that was already released')
  }
  player.pause.mockImplementation(released)
  player.play.mockImplementation(released)
}

describe('nostr video players', () => {
  beforeEach(() => {
    syncPlayers(null, [])
    useNostrVideoStore.setState({
      activeUrl: URL_A,
      failedUntil: {},
      loadedUrls: [URL_A, URL_B]
    })
  })

  it('registers players muted and looping', () => {
    const player = createPlayer()
    registerVideoPlayer(URL_A, player)

    expect(player.muted).toBe(true)
    expect(player.loop).toBe(true)
    expect(player.play).toHaveBeenCalledTimes(1)
  })

  it('plays only the newest player of a url and pauses the older one', () => {
    const feedPlayer = createPlayer()
    const notePlayer = createPlayer()
    registerVideoPlayer(URL_A, feedPlayer)
    feedPlayer.play.mockClear()
    registerVideoPlayer(URL_A, notePlayer)

    expect(notePlayer.play).toHaveBeenCalledTimes(1)
    expect(feedPlayer.pause).toHaveBeenCalledTimes(1)
    expect(feedPlayer.play).not.toHaveBeenCalled()
    expect(registeredVideoPlayerCount()).toBe(2)
  })

  it('pauses every player of a url when another url becomes active', () => {
    const feedPlayer = createPlayer()
    const notePlayer = createPlayer()
    registerVideoPlayer(URL_A, feedPlayer)
    registerVideoPlayer(URL_A, notePlayer)
    feedPlayer.pause.mockClear()

    useNostrVideoStore.setState({ activeUrl: URL_B })

    expect(feedPlayer.pause).toHaveBeenCalledTimes(1)
    expect(notePlayer.pause).toHaveBeenCalledTimes(1)
  })

  it('hands playback to the older player once the newest is released', () => {
    const feedPlayer = createPlayer()
    const notePlayer = createPlayer()
    registerVideoPlayer(URL_A, feedPlayer)
    registerVideoPlayer(URL_A, notePlayer)
    releasePlayer(notePlayer)
    feedPlayer.play.mockClear()

    syncPlayers(URL_A, [URL_A, URL_B])

    expect(feedPlayer.play).toHaveBeenCalledTimes(1)
    expect(registeredVideoPlayerCount()).toBe(1)
  })

  it('pauses and drops all players of a url that is unloaded', () => {
    const feedPlayer = createPlayer()
    const notePlayer = createPlayer()
    registerVideoPlayer(URL_A, feedPlayer)
    registerVideoPlayer(URL_A, notePlayer)
    feedPlayer.pause.mockClear()

    useNostrVideoStore.setState({ activeUrl: null, loadedUrls: [URL_B] })

    expect(feedPlayer.pause).toHaveBeenCalledTimes(1)
    expect(notePlayer.pause).toHaveBeenCalledTimes(1)
    expect(registeredVideoPlayerCount()).toBe(0)
  })
})
