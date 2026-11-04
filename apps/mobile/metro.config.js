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

// uint8array-tools' browser build base64-encodes by spreading every byte into
// String.fromCharCode, which overflows the call stack on large PSBTs. Ship its
// Buffer-backed build instead, the same one Jest runs.
const UINT8ARRAY_TOOLS_BROWSER_BUILD = 'uint8array-tools/src/mjs/browser.js'
const priorResolveRequest = defaultConfig.resolver.resolveRequest
defaultConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolution = (priorResolveRequest ?? context.resolveRequest)(
    context,
    moduleName,
    platform
  )
  const isBrowserBuild =
    resolution.type === 'sourceFile' &&
    resolution.filePath
      .replaceAll('\\', '/')
      .endsWith(UINT8ARRAY_TOOLS_BROWSER_BUILD)
  if (!isBrowserBuild) {
    return resolution
  }
  return {
    ...resolution,
    filePath: path.join(resolution.filePath, '..', '..', 'cjs', 'index.cjs')
  }
}

defaultConfig.resolver.sourceExts.push('md')
defaultConfig.transformer.babelTransformerPath =
  require.resolve('./metro.transformer.js')

const { withStorybook } = require('@storybook/react-native/metro/withStorybook')

const config = withStorybook(defaultConfig)

module.exports = config
