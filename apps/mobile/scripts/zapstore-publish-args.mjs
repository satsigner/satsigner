// Without a repository, Zapstore lists the app as closed-source. A local
// build carries it in the generated config (see zapstore-listing.mjs).
const SOURCE_REPOSITORY = 'https://github.com/satsigner/satsigner'

/**
 * Arguments for `zsp publish`. The commit is only claimed for a build from a
 * clean tree, so it matches the published code.
 */
function zspPublishArgs({ commit, target }) {
  const args = ['publish', '--json', '--quiet', '--skip-preview']
  if (commit) {
    args.push('--commit', commit)
  }
  args.push(target)
  return args
}

export { SOURCE_REPOSITORY, zspPublishArgs }
