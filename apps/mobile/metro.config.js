const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const defaultConfig = getDefaultConfig(__dirname)

// Maestro harness + results — not JS; watching them can crash Metro if the
// tree flips between directory and symlink.
const maestroBlock = new RegExp(
  `${path.resolve(__dirname, 'maestro').replaceAll(/[/\\]/g, '[/\\\\]')}[/\\\\].*`
)
const dotMaestroBlock = new RegExp(
  `${path.resolve(__dirname, '.maestro').replaceAll(/[/\\]/g, '[/\\\\]')}[/\\\\].*`
)
const priorBlock = defaultConfig.resolver.blockList
defaultConfig.resolver.blockList = priorBlock
  ? [priorBlock, maestroBlock, dotMaestroBlock].flat()
  : [maestroBlock, dotMaestroBlock]

defaultConfig.resolver.extraNodeModules = {
  assert: require.resolve('assert/'),
  buffer: require.resolve('buffer/'),
  events: require.resolve('events/'),
  process: require.resolve('process/')
}

defaultConfig.resolver.sourceExts.push('md')
defaultConfig.transformer.babelTransformerPath =
  require.resolve('./metro.transformer.js')

const { withStorybook } = require('@storybook/react-native/metro/withStorybook')

const config = withStorybook(defaultConfig)

// @branta-ops/branta/v2 is only listed under the package "import" export.
// Metro resolves with the "require" condition, then looks for a v2 file that
// does not exist. Point that specifier at the built entry.
const brantaV2Entry = path.resolve(
  __dirname,
  '../../node_modules/@branta-ops/branta/dist/v2/index.js'
)
const previousResolveRequest = config.resolver.resolveRequest

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@branta-ops/branta/v2') {
    return {
      filePath: brantaV2Entry,
      type: 'sourceFile'
    }
  }
  if (previousResolveRequest) {
    return previousResolveRequest(context, moduleName, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
