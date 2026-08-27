import { requireNativeModule } from 'expo-modules-core'
import { Platform } from 'react-native'

const ENCODING_BASE64 = 'base64'
const ENCODING_UTF8 = 'utf8'

type SafSaveNative = {
  saveDocument(
    filename: string,
    mimeType: string,
    contents: string,
    encoding: typeof ENCODING_BASE64 | typeof ENCODING_UTF8
  ): Promise<boolean>
}

export function saveDocument(
  filename: string,
  mimeType: string,
  contents: string,
  encoding: typeof ENCODING_BASE64 | typeof ENCODING_UTF8 = ENCODING_UTF8
): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return Promise.reject(
      new Error('Save to file is only available on Android')
    )
  }
  const native = requireNativeModule<SafSaveNative>('SafSave')
  return native.saveDocument(filename, mimeType, contents, encoding)
}
