module.exports = function exports(api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo']
  }
}
