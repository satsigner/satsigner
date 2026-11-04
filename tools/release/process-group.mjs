const KILL_GRACE_MS = 5000

// Jobs are spawned with `detached: true`, so each one leads its own process
// group. Signalling the group (negative pid) also reaches the processes it
// started, such as pnpm and gradlew, which a plain child.kill() leaves running.
function signalProcessGroup(pid, signal) {
  try {
    process.kill(-pid, signal)
    return true
  } catch (error) {
    if (error.code === 'ESRCH') {
      return false
    }
    throw error
  }
}

function stopProcessGroup(proc, graceMs = KILL_GRACE_MS) {
  if (!signalProcessGroup(proc.pid, 'SIGTERM')) {
    return
  }
  const timer = setTimeout(
    () => signalProcessGroup(proc.pid, 'SIGKILL'),
    graceMs
  )
  timer.unref()
}

export { signalProcessGroup, stopProcessGroup }
