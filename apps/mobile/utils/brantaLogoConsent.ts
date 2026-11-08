type BrantaLogoSession = 'allow' | 'deny' | 'unset'

type BrantaLogoConsentState = {
  ownerId: string | null
  session: BrantaLogoSession
}

const listeners = new Set<() => void>()
const waitingOwnerIds = new Set<string>()

let state: BrantaLogoConsentState = {
  ownerId: null,
  session: 'unset'
}

function emit() {
  for (const listener of listeners) {
    listener()
  }
}

function ownerIdFor(session: BrantaLogoSession) {
  if (session !== 'unset') {
    return null
  }
  const [firstWaiting = null] = waitingOwnerIds
  return firstWaiting
}

function syncOwner() {
  const ownerId = ownerIdFor(state.session)
  if (ownerId === state.ownerId) {
    return
  }
  state = { ...state, ownerId }
  emit()
}

function getBrantaLogoConsent(): BrantaLogoConsentState {
  return state
}

function subscribeBrantaLogoConsent(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function brantaLogoPromptRef(ownerId: string) {
  return function waitWhileMounted() {
    waitingOwnerIds.add(ownerId)
    syncOwner()
    return () => {
      waitingOwnerIds.delete(ownerId)
      syncOwner()
    }
  }
}

function setBrantaLogoSession(session: Exclude<BrantaLogoSession, 'unset'>) {
  state = { ownerId: null, session }
  emit()
}

function resetBrantaLogoConsent() {
  state = { ownerId: ownerIdFor('unset'), session: 'unset' }
  emit()
}

export {
  brantaLogoPromptRef,
  getBrantaLogoConsent,
  resetBrantaLogoConsent,
  setBrantaLogoSession,
  subscribeBrantaLogoConsent
}
export type { BrantaLogoConsentState, BrantaLogoSession }
