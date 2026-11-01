export function createLatestRequestTracker() {
  const state = { latestRequestId: 0 }

  function beginRequest() {
    state.latestRequestId += 1
    const requestId = state.latestRequestId
    return function isLatestRequest() {
      return requestId === state.latestRequestId
    }
  }

  return { beginRequest }
}

export function applyIfLatest<T>(
  isLatestRequest: () => boolean,
  apply: (value: T) => void
) {
  return function applyLatest(value: T) {
    if (isLatestRequest()) {
      apply(value)
    }
  }
}
