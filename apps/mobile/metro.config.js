const { getDefaultConfig } = require('expo/metro-config')

const defaultConfig = getDefaultConfig(__dirname)

defaultConfig.resolver.extraNodeModules = {
  assert: require.resolve('assert/'),
  buffer: require.resolve('buffer/'),
  events: require.resolve('events/'),
  process: require.resolve('process/'),
}

const withStorybook = require('@storybook/react-native/metro/withStorybook')

module.exports = withStorybook(defaultConfig)
