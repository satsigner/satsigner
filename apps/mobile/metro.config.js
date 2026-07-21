const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const defaultConfig = getDefaultConfig(__dirname)

// Maestro harness + results — not JS; watching them can crash Metro if the
// tree flips between directory and symlink.
const maestroBlock = new RegExp(
  `${path
    .resolve(__dirname, 'maestro')
    .replace(/[/\\]/g, '[/\\\\]')}[/\\\\].*`
)
const dotMaestroBlock = new RegExp(
  `${path
    .resolve(__dirname, '.maestro')
    .replace(/[/\\]/g, '[/\\\\]')}[/\\\\].*`
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

const { withStorybook } = require('@storybook/react-native/metro/withStorybook')

module.exports = withStorybook(defaultConfig)
