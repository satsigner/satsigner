type BrantaLookupWaiter = (allowed: boolean) => void

const listeners = new Set<() => void>()

let waiter: BrantaLookupWaiter | null = null

function emit() {
  for (const listener of listeners) {
    listener()
  }
}

function brantaLookupGateOpen() {
  return waiter !== null
}

function subscribeBrantaLookupGate(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function askBrantaLookup() {
  return new Promise<boolean>((resolve) => {
    if (waiter) {
      resolve(false)
      return
    }
    waiter = resolve
    emit()
  })
}

function answerBrantaLookup(allowed: boolean) {
  const current = waiter
  waiter = null
  emit()
  current?.(allowed)
}

export {
  answerBrantaLookup,
  askBrantaLookup,
  brantaLookupGateOpen,
  subscribeBrantaLookupGate
}
