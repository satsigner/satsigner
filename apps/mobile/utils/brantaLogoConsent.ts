type BrantaLogoSession = 'allow' | 'deny' | 'unset'

type BrantaLogoConsentState = {
  ownerId: string | null
  session: BrantaLogoSession
}

const listeners = new Set<() => void>()

let state: BrantaLogoConsentState = {
  ownerId: null,
  session: 'unset'
}

function emit() {
  for (const listener of listeners) {
    listener()
  }
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

function claimBrantaLogoPrompt(ownerId: string) {
  if (state.session !== 'unset' || state.ownerId) {
    return
  }
  state = { ...state, ownerId }
  emit()
}

function releaseBrantaLogoPrompt(ownerId: string) {
  if (state.ownerId !== ownerId) {
    return
  }
  state = { ...state, ownerId: null }
  emit()
}

function setBrantaLogoSession(session: Exclude<BrantaLogoSession, 'unset'>) {
  state = { ownerId: null, session }
  emit()
}

function resetBrantaLogoConsent() {
  state = { ownerId: null, session: 'unset' }
  emit()
}

export {
  claimBrantaLogoPrompt,
  getBrantaLogoConsent,
  releaseBrantaLogoPrompt,
  resetBrantaLogoConsent,
  setBrantaLogoSession,
  subscribeBrantaLogoConsent
}
export type { BrantaLogoConsentState, BrantaLogoSession }
