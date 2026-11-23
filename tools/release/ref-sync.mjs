const GITHUB_REMOTE = 'origin'
const NOSTR_REMOTE = 'ngit'
const SYNC_NAMESPACE = 'refs/sync'
const SHORT_SHA = 7
// ngit serves open proposals as pr/* branches; they are not branches to copy.
const PROPOSAL_PREFIX = 'pr/'

const BRANCH_STATES = {
  diverged: { badge: 'FIX', status: 'fail', target: 'conflict' },
  'github-ahead': { badge: 'PUSH', status: 'warn', target: 'ngit' },
  'merged-on-github': { badge: 'DEL', status: 'warn', target: 'prune' },
  'ngit-ahead': { badge: 'PUSH', status: 'warn', target: 'github' },
  'only-github': { badge: 'PUSH', status: 'warn', target: 'ngit' },
  'only-ngit': { badge: 'PUSH', status: 'warn', target: 'github' },
  same: { badge: 'OK', status: 'pass', target: '' }
}

const TAG_STATES = {
  different: { badge: 'FIX', status: 'fail', target: 'conflict' },
  'only-github': { badge: 'PUSH', status: 'warn', target: 'ngit' },
  'only-ngit': { badge: 'PUSH', status: 'warn', target: 'github' },
  same: { badge: 'OK', status: 'pass', target: '' }
}

const STATE_DETAILS = {
  different: 'The tag points at different commits. Fix it by hand.',
  diverged: 'Both sides have commits the other lacks. Merge or rebase by hand.',
  'github-ahead': 'ngit is behind. Fast-forward ngit.',
  'merged-on-github': 'Only on ngit, already merged on GitHub. Leftover.',
  'ngit-ahead': 'GitHub is behind. Fast-forward GitHub.',
  'only-github': 'Only on GitHub. Create it on ngit.',
  'only-ngit': 'Only on ngit, with commits GitHub lacks. Create it on GitHub.',
  same: 'In sync.'
}

function syncNamespace(remote, kind) {
  return `${SYNC_NAMESPACE}/${remote}/${kind}`
}

// A private namespace keeps the snapshot apart from refs/remotes and local
// tags, and --prune drops refs deleted on the remote.
function buildSyncFetchArgs(remote) {
  return [
    'fetch',
    '--no-tags',
    '--prune',
    remote,
    `+refs/heads/*:${syncNamespace(remote, 'heads')}/*`,
    `+refs/tags/*:${syncNamespace(remote, 'tags')}/*`
  ]
}

function buildSyncRefListArgs(remote, kind) {
  return [
    'for-each-ref',
    '--format=%(objectname) %(refname)',
    syncNamespace(remote, kind)
  ]
}

function parseRefList(text, prefix) {
  const refs = new Map()
  for (const line of text.split('\n')) {
    const [sha, ref] = line.trim().split(' ')
    if (sha && ref?.startsWith(`${prefix}/`)) {
      refs.set(ref.slice(prefix.length + 1), sha)
    }
  }
  return refs
}

function refNames(github, ngit) {
  return [...new Set([...github.keys(), ...ngit.keys()])]
    .filter((name) => !name.startsWith(PROPOSAL_PREFIX))
    .toSorted()
}

function branchState({ github, inGithub, ngit, relation }) {
  if (!ngit) {
    return 'only-github'
  }
  if (!github) {
    return inGithub ? 'merged-on-github' : 'only-ngit'
  }
  return relation
}

function tagState({ github, ngit }) {
  if (!ngit) {
    return 'only-github'
  }
  if (!github) {
    return 'only-ngit'
  }
  return github === ngit ? 'same' : 'different'
}

function shaPair({ github, ngit }) {
  const side = (label, sha) => `${label} ${sha ? sha.slice(0, SHORT_SHA) : '-'}`
  return `${side('GitHub', github)} · ${side('ngit', ngit)}`
}

function planRow(kind, fact, state, states) {
  return {
    ...states[state],
    detail: `${STATE_DETAILS[state]} ${shaPair(fact)}`,
    kind,
    name: fact.name,
    state
  }
}

function syncPlan({ branches, tags }) {
  return [
    ...branches.map((fact) =>
      planRow('heads', fact, branchState(fact), BRANCH_STATES)
    ),
    ...tags.map((fact) => planRow('tags', fact, tagState(fact), TAG_STATES))
  ]
}

function rowsFor(plan, target) {
  return plan.filter((row) => row.target === target)
}

function syncCounts(plan) {
  return {
    conflict: rowsFor(plan, 'conflict').length,
    github: rowsFor(plan, 'github').length,
    ngit: rowsFor(plan, 'ngit').length,
    prune: rowsFor(plan, 'prune').length,
    same: rowsFor(plan, '').length
  }
}

// No refspec starts with "+", so the remote refuses anything but a
// fast-forward or a new ref.
function buildSyncPushArgs(plan, target) {
  const [remote, source] =
    target === 'ngit'
      ? [NOSTR_REMOTE, GITHUB_REMOTE]
      : [GITHUB_REMOTE, NOSTR_REMOTE]
  const refspecs = rowsFor(plan, target).map(
    ({ kind, name }) =>
      `${syncNamespace(source, kind)}/${name}:refs/${kind}/${name}`
  )
  return refspecs.length === 0 ? [] : ['push', remote, ...refspecs]
}

function buildSyncPruneArgs(plan) {
  const refspecs = rowsFor(plan, 'prune').map(
    ({ name }) => `:refs/heads/${name}`
  )
  return refspecs.length === 0 ? [] : ['push', NOSTR_REMOTE, ...refspecs]
}

export {
  GITHUB_REMOTE,
  NOSTR_REMOTE,
  buildSyncFetchArgs,
  buildSyncPruneArgs,
  buildSyncPushArgs,
  buildSyncRefListArgs,
  parseRefList,
  refNames,
  syncCounts,
  syncNamespace,
  syncPlan
}
