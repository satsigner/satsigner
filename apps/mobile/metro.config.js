const { getDefaultConfig } = require('expo/metro-config')

const defaultConfig = getDefaultConfig(__dirname)

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

module.exports = withStorybook(defaultConfig)
