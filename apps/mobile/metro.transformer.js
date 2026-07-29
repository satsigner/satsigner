const upstreamTransformer = require('@expo/metro-config/babel-transformer')

module.exports.transform = ({ src, filename, options }) => {
  if (filename.endsWith('.md')) {
    return upstreamTransformer.transform({
      filename,
      options,
      src: `module.exports = ${JSON.stringify(src)}`
    })
  }
  return upstreamTransformer.transform({ filename, options, src })
}

module.exports.getCacheKey = upstreamTransformer.getCacheKey
