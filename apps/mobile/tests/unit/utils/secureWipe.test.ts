import * as SecureStore from 'expo-secure-store'
import { __store as secureStore } from 'expo-secure-store'

import { Nip46BunkerService } from '@/api/nostrNip446'
import {
  DURESS_KDF_KEY,
  DURESS_PIN_KEY,
  PIN_KDF_COMMIT_KEY,
  PIN_KDF_KEY,
  PIN_KEY,
  PIN_LENGTH_KEY,
  SALT_KEY,
  SALT_KEY_DURESS
} from '@/config/auth'
import * as nostrCache from '@/db/nostrCache'
import * as nostrProcessedEvents from '@/db/nostrProcessedEvents'
import * as arkWallet from '@/services/arkWallet'
import { getNip46Runtime, registerNip46Session } from '@/services/nip46Sessions'
import * as arkDatadir from '@/storage/arkDatadir'
import {
  persistDevConsoleEntry,
  rotateDevConsoleSession
} from '@/storage/devConsoleLog'
import { useArkStore } from '@/store/ark'
import { useAuthStore } from '@/store/auth'
import { useDevConsoleStore } from '@/store/devConsole'
import { useEcashStore } from '@/store/ecash'
import { useNip46Store } from '@/store/nip46'
import { useNostrIdentityDraftStore } from '@/store/nostrIdentityDraft'
import type { ArkAccount } from '@/types/models/Ark'
import type { DevConsoleEntry } from '@/types/models/DevConsole'
import * as devConsole from '@/utils/devConsole'
import { getPin } from '@/utils/pin'
import { getSessionPinDigest, setSessionPinDigest } from '@/utils/pinSession'
import {
  secureWipeAfterMaxPinTries,
  secureWipeAllWalletData
} from '@/utils/secureWipe'

const sk = (key: string) => `1_${key}`

const PIN_BOUND_KEYS = [
  PIN_KEY,
  SALT_KEY,
  PIN_KDF_KEY,
  PIN_KDF_COMMIT_KEY,
  PIN_LENGTH_KEY,
  DURESS_PIN_KEY,
  DURESS_KDF_KEY,
  SALT_KEY_DURESS
]

const PERSIST_FAILED = 'persist failed'

const ARK_ACCOUNT: ArkAccount = {
  bitcoinAccountId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  id: 'ark-1',
  name: 'Ark',
  network: 'signet',
  serverId: 'second'
}

describe('secureWipeAfterMaxPinTries', () => {
  beforeEach(() => {
    for (const key of Object.keys(secureStore)) {
      delete secureStore[key]
    }
    for (const key of PIN_BOUND_KEYS) {
      secureStore[sk(key)] = `stored-${key}`
    }
    setSessionPinDigest('session-digest')
    useAuthStore.setState({
      duressPinEnabled: true,
      firstTime: false,
      lockTriggered: true,
      pinTries: 5,
      requiresAuth: true
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest
      .mocked(SecureStore.deleteItemAsync)
      .mockImplementation((key: string) => {
        delete secureStore[key]
        return Promise.resolve()
      })
    useAuthStore.setState(useAuthStore.getInitialState(), true)
  })

  it('leaves no PIN, duress PIN or session key for the next PIN to inherit', async () => {
    await expect(secureWipeAfterMaxPinTries()).resolves.toBe(true)

    for (const key of PIN_BOUND_KEYS) {
      expect(secureStore[sk(key)]).toBeUndefined()
    }
    expect(getSessionPinDigest()).toBeNull()
    await expect(getPin()).rejects.toThrow('PIN unavailable')
  })

  it('drops a backup restore waiting for the next unlock and the page history', async () => {
    useAuthStore.setState({
      pageHistory: ['/signer/bitcoin/account/acc'],
      pendingRecoverData: 'decrypted-backup',
      restoredPublicServerName: 'Mempool'
    })

    await secureWipeAllWalletData()

    expect(useAuthStore.getState().pendingRecoverData).toBeNull()
    expect(useAuthStore.getState().pageHistory).toStrictEqual([])
    expect(useAuthStore.getState().restoredPublicServerName).toBeNull()
  })

  it('stops the Ark daemons before deleting their datadirs', async () => {
    useArkStore.setState({ accounts: [ARK_ACCOUNT] })
    const release = jest
      .spyOn(arkWallet, 'releaseAllArkWalletsAndSubscriptions')
      .mockResolvedValue()
    const deleteDatadir = jest
      .spyOn(arkDatadir, 'deleteArkDatadir')
      .mockResolvedValue()

    await secureWipeAllWalletData()

    expect(deleteDatadir).toHaveBeenCalledWith(ARK_ACCOUNT.id)
    expect(release.mock.invocationCallOrder[0]).toBeLessThan(
      deleteDatadir.mock.invocationCallOrder[0]
    )
  })

  it('stops a running bunker and forgets its sessions', async () => {
    const service = new Nip46BunkerService()
    const disconnect = jest.spyOn(service, 'disconnect').mockReturnValue()
    registerNip46Session('bunker-a', service, new Uint8Array(32))

    await secureWipeAllWalletData()

    expect(disconnect).toHaveBeenCalledTimes(1)
    expect(getNip46Runtime('bunker-a')).toBeNull()
    expect(useNip46Store.getState().sessions).toStrictEqual([])
  })

  it('drops the seed of a nostr identity that was being created', async () => {
    useNostrIdentityDraftStore.getState().setDraftMnemonic('abandon about')

    await secureWipeAllWalletData()

    expect(useNostrIdentityDraftStore.getState().mnemonic).toBeNull()
  })

  it('clears the nostr event cache and dedupe tables', async () => {
    const clearCache = jest.spyOn(nostrCache, 'clearAllCache')
    const clearProcessed = jest.spyOn(
      nostrProcessedEvents,
      'clearNostrProcessedEvents'
    )

    await secureWipeAfterMaxPinTries()

    expect(clearCache).toHaveBeenCalledWith()
    expect(clearProcessed).toHaveBeenCalledWith()
  })

  it('drops the dev console log', async () => {
    const line: DevConsoleEntry = {
      id: 0,
      level: 'info',
      message: 'account Savings failed to sync',
      scope: 'sync',
      time: 0
    }
    persistDevConsoleEntry(line)
    useDevConsoleStore.getState().addEntry(line)

    await secureWipeAfterMaxPinTries()

    expect(useDevConsoleStore.getState().entries).toStrictEqual([])
    expect(rotateDevConsoleSession()).toStrictEqual([])
  })

  it('finishes the wipe when the dev console log cannot be cleared', async () => {
    jest.spyOn(devConsole, 'wipeDevConsoleLog').mockImplementation(() => {
      throw new Error('keystore unavailable')
    })

    await expect(secureWipeAfterMaxPinTries()).resolves.toBe(true)

    for (const key of PIN_BOUND_KEYS) {
      expect(secureStore[sk(key)]).toBeUndefined()
    }
  })

  it('stays locked when the PIN material cannot be deleted', async () => {
    jest
      .mocked(SecureStore.deleteItemAsync)
      .mockImplementation((key: string) => {
        if (key === sk(PIN_KEY)) {
          return Promise.reject(new Error('keystore unavailable'))
        }
        delete secureStore[key]
        return Promise.resolve()
      })

    await expect(secureWipeAfterMaxPinTries()).resolves.toBe(false)

    expect(secureStore[sk(PIN_KEY)]).toBe(`stored-${PIN_KEY}`)
    expect(getSessionPinDigest()).toBe('session-digest')
    expect(useAuthStore.getState()).toStrictEqual(
      expect.objectContaining({
        firstTime: false,
        lockTriggered: true,
        requiresAuth: true
      })
    )
  })

  it('stays locked when the wallet wipe rejects', async () => {
    const ecashState = useEcashStore.getState()
    jest.spyOn(useEcashStore, 'getState').mockReturnValue({
      ...ecashState,
      accounts: [],
      clearAllData: () => {
        throw new Error(PERSIST_FAILED)
      }
    })

    await expect(secureWipeAfterMaxPinTries()).resolves.toBe(false)

    expect(secureStore[sk(PIN_KEY)]).toBe(`stored-${PIN_KEY}`)
    expect(useAuthStore.getState()).toStrictEqual(
      expect.objectContaining({
        firstTime: false,
        lockTriggered: true,
        requiresAuth: true
      })
    )
  })

  it('resets the app to a fresh install', async () => {
    await expect(secureWipeAfterMaxPinTries()).resolves.toBe(true)

    expect(useAuthStore.getState()).toStrictEqual(
      expect.objectContaining({
        duressPinEnabled: false,
        firstTime: true,
        lockTriggered: false,
        pinTries: 0,
        requiresAuth: false
      })
    )
  })
})
