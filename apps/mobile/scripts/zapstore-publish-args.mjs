// Without -r, Zapstore lists the app as closed-source: zsp only learns the
// source repository from this flag when it is handed an APK file.
const SOURCE_REPOSITORY = 'github.com/satsigner/satsigner'

/**
 * Arguments for `zsp publish`. A config yaml carries its own repository, so
 * -r and --commit are only added for a local APK. The commit is only claimed
 * when the APK was built from a clean tree, so it matches the published code.
 */
function zspPublishArgs({ commit, indexerMode, target, usingConfig }) {
  const args = ['publish', '--json', '--quiet', '--skip-preview']
  if (indexerMode) {
    args.push('--indexer-mode')
  }
  if (!usingConfig) {
    args.push('-r', SOURCE_REPOSITORY)
    if (commit) {
      args.push('--commit', commit)
    }
  }
  args.push(target)
  return args
}

export { SOURCE_REPOSITORY, zspPublishArgs }
