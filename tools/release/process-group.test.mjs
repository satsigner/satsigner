import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import test from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'

import { signalProcessGroup, stopProcessGroup } from './process-group.mjs'

function isAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function waitUntil(check, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs
  while (!check()) {
    if (Date.now() > deadline) {
      return false
    }
    await sleep(20)
  }
  return true
}

function spawnWithGrandchild(script) {
  const proc = spawn('sh', ['-c', script], {
    detached: true,
    stdio: ['ignore', 'pipe', 'ignore']
  })
  const grandchild = new Promise((resolve) => {
    proc.stdout.once('data', (chunk) => resolve(Number(chunk.toString())))
  })
  return { grandchild, proc }
}

test('stops the job and the processes it started', async () => {
  const { grandchild, proc } = spawnWithGrandchild('sleep 30 & echo $!; wait')
  const grandchildPid = await grandchild
  assert.equal(isAlive(grandchildPid), true)
  const closed = once(proc, 'close')

  stopProcessGroup(proc)
  await closed

  assert.equal(await waitUntil(() => !isAlive(grandchildPid)), true)
})

test('kills processes that ignore SIGTERM after the grace period', async () => {
  const { grandchild, proc } = spawnWithGrandchild(
    "trap '' TERM; sh -c \"trap '' TERM; sleep 30\" & echo $!; wait"
  )
  const grandchildPid = await grandchild
  const closed = once(proc, 'close')

  stopProcessGroup(proc, 100)

  assert.equal(await waitUntil(() => !isAlive(grandchildPid)), true)
  await closed
})

test('reports a group that already exited', async () => {
  const proc = spawn('true', [], { detached: true, stdio: 'ignore' })
  await once(proc, 'close')

  assert.equal(signalProcessGroup(proc.pid, 'SIGTERM'), false)
})
