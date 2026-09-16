/** Shared chunk loader so unlock can preload the same module lazy() waits on. */
function loadAuthenticatedSession() {
  return import('@/app/(authenticated)/_session')
}

export { loadAuthenticatedSession }
