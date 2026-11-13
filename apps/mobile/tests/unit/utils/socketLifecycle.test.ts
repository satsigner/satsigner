import { EventEmitter } from 'node:events'

import { destroyOnceSettled } from '@/utils/socketLifecycle'

class FakeSocket extends EventEmitter {
  pending = true
}

describe('destroyOnceSettled', () => {
  it('destroys a connected socket right away', () => {
    const socket = new FakeSocket()
    socket.pending = false
    const destroy = jest.fn()

    destroyOnceSettled(socket, destroy)

    expect(destroy).toHaveBeenCalledTimes(1)
  })

  it('waits for a connecting socket to connect', () => {
    const socket = new FakeSocket()
    const destroy = jest.fn()

    destroyOnceSettled(socket, destroy)
    expect(destroy).not.toHaveBeenCalled()

    socket.emit('connect')
    expect(destroy).toHaveBeenCalledTimes(1)
  })

  it('destroys a connecting socket once its connect fails', () => {
    const socket = new FakeSocket()
    const destroy = jest.fn()

    destroyOnceSettled(socket, destroy)
    socket.emit('error')
    socket.emit('connect')

    expect(destroy).toHaveBeenCalledTimes(1)
    expect(socket.listenerCount('connect')).toBe(0)
    expect(socket.listenerCount('error')).toBe(0)
  })
})
