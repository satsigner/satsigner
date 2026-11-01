import 'expo/src/winter/runtime.native'

// Expo installs these as lazy globals. The getter `require`s a polyfill, and
// Jest's node environment rejects that require once a test file is loading.
// Reading them here, from setupFiles, materializes the values while requiring
// is still allowed.
const globals = globalThis as Record<string, unknown>
void globals.TextDecoderStream
void globals.TextEncoderStream
void globals.URL
void globals.URLSearchParams
void globals.DOMException
void globals.structuredClone
void globals.__ExpoImportMetaRegistry
