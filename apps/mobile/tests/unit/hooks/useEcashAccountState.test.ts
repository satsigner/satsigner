import { createElement, Fragment } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import { useEcashAccountState } from '@/hooks/useEcashAccountState'
import { useEcashActiveAccountSync } from '@/hooks/useEcashActiveAccountSync'
import { useEcashStore } from '@/store/ecash'
import type { EcashAccount, EcashProof } from '@/types/models/Ecash'

jest.mock<typeof import('expo-router')>('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react')
  return {
    useFocusEffect: (effect: () => void) => {
      useEffect(effect, [effect])
    }
  }
})

const MINT_URL = 'https://mint.example'
const MAX_RENDERS = 20

function makeAccount(id: string): EcashAccount {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    hasSeed: true,
    id,
    name: `Account ${id}`
  }
}

function makeProof(secret: string, amount: number): EcashProof {
  return { C: `C-${secret}`, amount, id: 'ks-1', mintUrl: MINT_URL, secret }
}

function seedAccount(id: string, proofs: EcashProof[]) {
  const store = useEcashStore.getState()
  store.addAccount(makeAccount(id))
  store.setProofs(id, proofs)
}

type AccountState = ReturnType<typeof useEcashAccountState>

const mountedRenderers: ReactTestRenderer[] = []

/** The account page's store wiring: data from the route id, synced on focus. */
function renderAccountScreens(ids: string[]) {
  const results: Record<string, AccountState> = {}
  const renders: Record<string, number> = {}
  function AccountScreen({ id }: { id: string }) {
    renders[id] = (renders[id] ?? 0) + 1
    if (renders[id] > MAX_RENDERS) {
      throw new Error(`account ${id} screen keeps rendering`)
    }
    results[id] = useEcashAccountState(id)
    useEcashActiveAccountSync(id)
    return null
  }
  const screens = ids.map((id) => createElement(AccountScreen, { id, key: id }))
  act(() => {
    mountedRenderers.push(create(createElement(Fragment, null, ...screens)))
  })
  return { renders, results }
}

describe('ecash account screens', () => {
  beforeEach(() => {
    useEcashStore.getState().clearAllData()
  })

  afterEach(() => {
    act(() => {
      for (const renderer of mountedRenderers.splice(0)) {
        renderer.unmount()
      }
    })
  })

  it('shows the account of the route even when another one is active', () => {
    seedAccount('acc-x', [makeProof('x-1', 5)])
    seedAccount('acc-y', [makeProof('y-1', 8), makeProof('y-2', 2)])
    useEcashStore.getState().setActiveAccountId('acc-x')

    const { results } = renderAccountScreens(['acc-y'])

    expect(results['acc-y'].activeAccount?.id).toBe('acc-y')
    expect(results['acc-y'].proofs.map((proof) => proof.secret)).toStrictEqual([
      'y-1',
      'y-2'
    ])
  })

  it('makes the focused account the active one', () => {
    seedAccount('acc-x', [])
    seedAccount('acc-y', [])
    useEcashStore.getState().setActiveAccountId('acc-x')

    renderAccountScreens(['acc-y'])

    expect(useEcashStore.getState().activeAccountId).toBe('acc-y')
  })

  it('never makes a deleted account active again', () => {
    seedAccount('acc-x', [])
    useEcashStore.getState().setActiveAccountId('acc-x')
    useEcashStore.getState().removeAccount('acc-x')

    renderAccountScreens(['acc-x'])

    expect(useEcashStore.getState().activeAccountId).toBeNull()
  })

  it('settles when a deleted account screen is still mounted under a new one', () => {
    seedAccount('acc-x', [])
    useEcashStore.getState().setActiveAccountId('acc-x')
    const stale = renderAccountScreens(['acc-x'])
    act(() => {
      useEcashStore.getState().removeAccount('acc-x')
    })

    act(() => {
      seedAccount('acc-y', [makeProof('y-1', 3)])
      useEcashStore.getState().setActiveAccountId('acc-y')
    })
    const { renders, results } = renderAccountScreens(['acc-y'])

    expect(useEcashStore.getState().activeAccountId).toBe('acc-y')
    expect(results['acc-y'].proofs).toHaveLength(1)
    expect(stale.renders['acc-x']).toBeLessThan(MAX_RENDERS)
    expect(renders['acc-y']).toBeLessThan(MAX_RENDERS)
  })
})
