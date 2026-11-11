import { WALLET_CHAIN_CHECK_LIMIT } from '@/constants/sync'
import { isWalletOnServerChain } from '@/utils/walletChain'

const GENESIS = { hash: 'genesis', height: 0 }

function serverChain(tipHeight: number, hashes: Record<number, string>) {
  return {
    blockHash: jest.fn((height: number) =>
      Promise.resolve(hashes[height] ?? `other-${height}`)
    ),
    tipHeight: jest.fn(() => Promise.resolve(tipHeight))
  }
}

describe('isWalletOnServerChain', () => {
  it('passes a wallet that has seen no block yet', async () => {
    const server = serverChain(100, {})

    await expect(isWalletOnServerChain([GENESIS], server)).resolves.toBe(true)
    expect(server.tipHeight).not.toHaveBeenCalled()
  })

  it('passes when the newest wallet block is on the server', async () => {
    const server = serverChain(105, { 100: 'a100' })
    const checkpoints = [
      { hash: 'a100', height: 100 },
      { hash: 'a90', height: 90 },
      GENESIS
    ]

    await expect(isWalletOnServerChain(checkpoints, server)).resolves.toBe(true)
    expect(server.blockHash).toHaveBeenCalledTimes(1)
  })

  it('passes after a reorg replaced the newest wallet block', async () => {
    const server = serverChain(101, { 100: 'b100', 99: 'a99' })
    const checkpoints = [
      { hash: 'a100', height: 100 },
      { hash: 'a99', height: 99 },
      GENESIS
    ]

    await expect(isWalletOnServerChain(checkpoints, server)).resolves.toBe(true)
  })

  it('passes when the server is a few blocks behind the wallet', async () => {
    const server = serverChain(98, { 97: 'a97' })
    const checkpoints = [
      { hash: 'a100', height: 100 },
      { hash: 'a99', height: 99 },
      { hash: 'a97', height: 97 },
      GENESIS
    ]

    await expect(isWalletOnServerChain(checkpoints, server)).resolves.toBe(true)
    expect(server.blockHash).toHaveBeenCalledWith(97)
    expect(server.blockHash).not.toHaveBeenCalledWith(100)
  })

  it('fails when every wallet block is above the server tip', async () => {
    const server = serverChain(280_000, {})
    const checkpoints = [
      { hash: 'm3120000', height: 3_120_000 },
      { hash: 'm3119990', height: 3_119_990 },
      GENESIS
    ]

    await expect(isWalletOnServerChain(checkpoints, server)).resolves.toBe(
      false
    )
    expect(server.blockHash).not.toHaveBeenCalled()
  })

  it('fails when no wallet block hash is on the server', async () => {
    const server = serverChain(3_120_000, {})
    const checkpoints = [
      ...Array.from({ length: WALLET_CHAIN_CHECK_LIMIT + 5 }, (_, index) => ({
        hash: `s${280_000 - index}`,
        height: 280_000 - index
      })),
      GENESIS
    ]

    await expect(isWalletOnServerChain(checkpoints, server)).resolves.toBe(
      false
    )
    expect(server.blockHash).toHaveBeenCalledTimes(WALLET_CHAIN_CHECK_LIMIT)
  })
})
