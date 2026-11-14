type SettlingSocket = {
  readonly pending: boolean
  once(event: 'connect' | 'error', listener: () => void): unknown
  off(event: 'connect' | 'error', listener: () => void): unknown
}

/**
 * react-native-tcp-socket's Android module registers a socket only when its
 * connect task runs on a two-thread pool, and its destroy task throws on that
 * pool (killing the app) for an id it has not registered yet. A socket still
 * connecting is therefore destroyed only once its connect has settled.
 */
export function destroyOnceSettled(
  socket: SettlingSocket,
  destroy: () => void
) {
  if (!socket.pending) {
    destroy()
    return
  }
  function handleSettled() {
    socket.off('connect', handleSettled)
    socket.off('error', handleSettled)
    destroy()
  }
  socket.once('connect', handleSettled)
  socket.once('error', handleSettled)
}
