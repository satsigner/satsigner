import 'react-native-url-polyfill/auto'
import 'react-native-get-random-values'

// Add TextDecoder polyfill
if (typeof TextDecoder === 'undefined') {
  class TextDecoderPolyfill {
    decode(buffer) {
      if (buffer instanceof Uint8Array) {
        return String.fromCharCode.apply(null, buffer)
      }
      return String.fromCharCode.apply(null, new Uint8Array(buffer))
    }
  }
  global.TextDecoder = TextDecoderPolyfill
}

// Add TextEncoder polyfill
if (typeof TextEncoder === 'undefined') {
  class TextEncoderPolyfill {
    encode(str) {
      const arr = new Uint8Array(str.length)
      for (let i = 0; i < str.length; i++) {
        arr[i] = str.charCodeAt(i)
      }
      return arr
    }
  }
  global.TextEncoder = TextEncoderPolyfill
}

if (typeof __dirname === 'undefined') global.__dirname = '/'
if (typeof __filename === 'undefined') global.__filename = ''
if (typeof process === 'undefined') {
  global.process = require('process')
} else {
  const bProcess = require('process')
  for (const p in bProcess) {
    if (!(p in process)) {
      process[p] = bProcess[p]
    }
  }
}

process.browser = false
if (typeof Buffer === 'undefined') global.Buffer = require('buffer').Buffer

// global.location = global.location || { port: 80 }
const isDev = typeof __DEV__ === 'boolean' && __DEV__
process.env['NODE_ENV'] = isDev ? 'development' : 'production'
if (typeof localStorage !== 'undefined') {
  localStorage.debug = isDev ? '*' : ''
}
