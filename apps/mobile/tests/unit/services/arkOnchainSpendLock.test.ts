import { withArkOnchainSpendLock } from '@/services/arkOnchainSpendLock'
import { ArkOperationBusyError } from '@/utils/arkError'

describe('withArkOnchainSpendLock', () => {
  it('refuses a second spend of the same account while one runs', async () => {
    const gate: { open?: () => void } = {}
    const first = withArkOnchainSpendLock(
      'acc',
      () =>
        new Promise<string>((resolve) => {
          gate.open = () => resolve('boarded')
        })
    )

    await expect(
      withArkOnchainSpendLock('acc', () => Promise.resolve('swept'))
    ).rejects.toBeInstanceOf(ArkOperationBusyError)

    gate.open?.()
    await expect(first).resolves.toBe('boarded')
  })

  it('lets other accounts spend at the same time and frees the lock after', async () => {
    await expect(
      withArkOnchainSpendLock('other', () => Promise.resolve(1))
    ).resolves.toBe(1)
    await expect(
      withArkOnchainSpendLock('other', () => Promise.reject(new Error('x')))
    ).rejects.toThrow('x')
    await expect(
      withArkOnchainSpendLock('other', () => Promise.resolve(2))
    ).resolves.toBe(2)
  })
})
