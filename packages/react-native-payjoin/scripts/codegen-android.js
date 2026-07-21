/**
 * Generate React Native TurboModule Android codegen under
 * android/generated/... (same layout as react-native-bdk-sdk).
 * Required for cmakeListsPath autolinking.
 */
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')

const root = path.resolve(__dirname, '..')
const requireFromRoot = createRequire(path.join(root, 'package.json'))
const requireFromMobile = createRequire(
  path.join(root, '../../apps/mobile/package.json')
)

function resolveRn(file) {
  try {
    return requireFromRoot.resolve(file)
  } catch {
    return requireFromMobile.resolve(file)
  }
}

const schemaPath = path.join(root, 'android', '.payjoin-schema.json')
const outDir = path.join(
  root,
  'android/generated/android/app/build/generated/source/codegen'
)

fs.mkdirSync(path.dirname(schemaPath), { recursive: true })
fs.mkdirSync(outDir, { recursive: true })

const combineCli = resolveRn(
  '@react-native/codegen/lib/cli/combine/combine-js-to-schema-cli.js'
)
const generateCli = resolveRn('react-native/scripts/generate-specs-cli.js')
const nativeTs = path.join(root, 'src/NativePayjoin.ts')

execFileSync(process.execPath, [combineCli, schemaPath, nativeTs], {
  cwd: root,
  stdio: 'inherit'
})

execFileSync(
  process.execPath,
  [
    generateCli,
    '--platform',
    'android',
    '--schemaPath',
    schemaPath,
    '--outputDir',
    outDir,
    '--libraryName',
    'RNPayjoinSpec',
    '--javaPackageName',
    'com.satsigner.payjoin'
  ],
  { cwd: root, stdio: 'inherit' }
)

fs.rmSync(schemaPath, { force: true })
console.log('Wrote Android codegen to', outDir)
