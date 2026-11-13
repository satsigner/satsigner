import {
  WALLET_CHAIN_CHECK_LIMIT,
  WALLET_CHAIN_TIP_LAG_MARGIN
} from '@/constants/sync'
import { isWalletOnServerChain } from '@/utils/walletChain'

const GENESIS = { hash: '0'.repeat(64), height: 0 }

// A block hash of one chain at a height, in the 64 hex chars servers send.
function hashOn(chain: 'a' | 'b', height: number) {
  return `${chain}${height.toString(16).padStart(63, '0')}`
}

function blockOn(chain: 'a' | 'b', height: number) {
  return { hash: hashOn(chain, height), height }
}

function serverOnChain(chain: 'a' | 'b', tipHeight: number) {
  return {
    blockHash: jest.fn((height: number) =>
      Promise.resolve(hashOn(chain, height))
    ),
    tipHeight: jest.fn(() => Promise.resolve(tipHeight))
  }
}

describe('isWalletOnServerChain', () => {
  it('passes a wallet that has seen no block yet', async () => {
    const server = serverOnChain('a', 100)

    await expect(isWalletOnServerChain([GENESIS], server)).resolves.toBe(true)
    expect(server.tipHeight).not.toHaveBeenCalled()
  })

  it('passes when the newest wallet block is on the server', async () => {
    const server = serverOnChain('a', 105)
    const checkpoints = [blockOn('a', 100), blockOn('a', 90), GENESIS]

    await expect(isWalletOnServerChain(checkpoints, server)).resolves.toBe(true)
    expect(server.blockHash).toHaveBeenCalledTimes(1)
  })

  it('passes after a reorg replaced the newest wallet block', async () => {
    const server = serverOnChain('a', 101)
    const checkpoints = [blockOn('b', 100), blockOn('a', 99), GENESIS]

    await expect(isWalletOnServerChain(checkpoints, server)).resolves.toBe(true)
  })

  it('passes when the server is a few blocks behind the wallet', async () => {
    const server = serverOnChain('a', 98)
    const checkpoints = [
      blockOn('a', 100),
      blockOn('a', 99),
      blockOn('a', 97),
      GENESIS
    ]

    await expect(isWalletOnServerChain(checkpoints, server)).resolves.toBe(true)
    expect(server.blockHash).toHaveBeenCalledWith(97)
    expect(server.blockHash).not.toHaveBeenCalledWith(100)
  })

  it('passes a server catching up below every wallet block', async () => {
    const server = serverOnChain('a', 300_000 - WALLET_CHAIN_TIP_LAG_MARGIN)
    const checkpoints = [blockOn('a', 300_009), blockOn('a', 300_000), GENESIS]

    await expect(isWalletOnServerChain(checkpoints, server)).resolves.toBe(true)
    expect(server.blockHash).not.toHaveBeenCalled()
  })

  it('fails when every wallet block is far above the server tip', async () => {
    const server = serverOnChain('a', 280_000)
    const checkpoints = [
      blockOn('b', 3_120_000),
      blockOn('b', 3_119_990),
      GENESIS
    ]

    await expect(isWalletOnServerChain(checkpoints, server)).resolves.toBe(
      false
    )
    expect(server.blockHash).not.toHaveBeenCalled()
  })

  it('fails when no wallet block hash is on the server', async () => {
    const server = serverOnChain('b', 3_120_000)
    const checkpoints = [
      ...Array.from({ length: WALLET_CHAIN_CHECK_LIMIT + 5 }, (_, index) =>
        blockOn('a', 280_000 - index)
      ),
      GENESIS
    ]

    await expect(isWalletOnServerChain(checkpoints, server)).resolves.toBe(
      false
    )
    expect(server.blockHash).toHaveBeenCalledTimes(WALLET_CHAIN_CHECK_LIMIT)
  })

  it.each([Number.NaN, 0, undefined])(
    'gives up on a tip height it cannot read (%s)',
    async (tipHeight) => {
      const server = {
        blockHash: jest.fn(),
        tipHeight: jest.fn(() => Promise.resolve(Number(tipHeight)))
      }

      await expect(
        isWalletOnServerChain([blockOn('a', 100), GENESIS], server)
      ).rejects.toThrow('chain tip')
    }
  )

  it('gives up on a block hash it cannot read', async () => {
    const server = {
      blockHash: jest.fn(() => Promise.resolve('<html>login</html>')),
      tipHeight: jest.fn(() => Promise.resolve(105))
    }

    await expect(
      isWalletOnServerChain([blockOn('a', 100), GENESIS], server)
    ).rejects.toThrow('block hash')
  })
})
