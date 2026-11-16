/* oxlint-disable class-methods-use-this -- polyfills mirror the TextDecoder and TextEncoder instance APIs */
import 'react-native-get-random-values'

if (typeof TextDecoder === 'undefined') {
  class TextDecoderPolyfill {
    decode(buffer) {
      if (buffer instanceof Uint8Array) {
        return String.fromCodePoint.apply(null, buffer)
      }
      return String.fromCodePoint.apply(null, new Uint8Array(buffer))
    }
  }
  global.TextDecoder = TextDecoderPolyfill
}

if (typeof TextEncoder === 'undefined') {
  class TextEncoderPolyfill {
    encode(str) {
      const arr = new Uint8Array(str.length)
      for (let i = 0; i < str.length; i += 1) {
        // oxlint-disable-next-line unicorn/prefer-code-point -- one byte per UTF-16 code unit, as the polyfill always wrote
        arr[i] = str.charCodeAt(i)
      }
      return arr
    }
  }
  global.TextEncoder = TextEncoderPolyfill
}

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

global.Buffer = require('buffer').Buffer
