function isMailboxExpiredError(message: string): boolean {
  const lower = message.toLowerCase()
  if (lower.includes('session expired')) {
    return true
  }
  if (!lower.includes('expired')) {
    return false
  }
  return (
    lower.includes('protocol error') ||
    lower.includes('createrequesterror') ||
    lower.includes('expired(time')
  )
}

function isAlreadyHasProposalError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('already has a proposal') ||
    lower.includes('already has unchecked proposal') ||
    lower.includes('finalize instead of polling')
  )
}

export { isAlreadyHasProposalError, isMailboxExpiredError }
