import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import { useDecryptedKeys } from '@/hooks/useDecryptedKeys'
import { type Account, type Key } from '@/types/models/Account'
import { decryptAccountKeysOrFallback } from '@/utils/decryption'

jest.mock<Partial<typeof import('@/utils/decryption')>>(
  '@/utils/decryption',
  () => ({ decryptAccountKeysOrFallback: jest.fn() })
)

const mockDecrypt = jest.mocked(decryptAccountKeysOrFallback)

function makeKey(secret: string): Key {
  return { creationType: 'importMnemonic', index: 0, iv: '', secret }
}

function makeAccount(id: string, secret: string) {
  return { id, keys: [makeKey(secret)] }
}

describe('useDecryptedKeys', () => {
  it("never returns the previous account's keys for a new account", async () => {
    const accountA = makeAccount('a', 'encrypted-a')
    const accountB = makeAccount('b', 'encrypted-b')
    const decryptedA = [makeKey('decrypted-a')]
    mockDecrypt.mockResolvedValueOnce(decryptedA)
    // Account B's decryption never settles during the test.
    mockDecrypt.mockReturnValueOnce(new Promise(() => {}))

    const result: { current: Key[] } = { current: [] }
    function Harness({ account }: { account: Pick<Account, 'id' | 'keys'> }) {
      result.current = useDecryptedKeys(account)
      return null
    }

    let renderer: ReactTestRenderer | undefined
    await act(async () => {
      renderer = create(createElement(Harness, { account: accountA }))
    })
    expect(result.current).toBe(decryptedA)

    await act(async () => {
      renderer?.update(createElement(Harness, { account: accountB }))
    })
    expect(result.current).toStrictEqual([])
  })

  it('returns no keys once the account has none left', async () => {
    const account = makeAccount('a', 'encrypted-a')
    mockDecrypt.mockResolvedValueOnce([makeKey('decrypted-a')])

    const result: { current: Key[] } = { current: [] }
    function Harness({ keys }: { keys: Key[] }) {
      result.current = useDecryptedKeys({ id: account.id, keys })
      return null
    }

    let renderer: ReactTestRenderer | undefined
    await act(async () => {
      renderer = create(createElement(Harness, { keys: account.keys }))
    })
    expect(result.current).toHaveLength(1)

    await act(async () => {
      renderer?.update(createElement(Harness, { keys: [] }))
    })
    expect(result.current).toStrictEqual([])
  })
})
