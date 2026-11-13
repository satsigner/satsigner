import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parsePermissions } from './apk-review.mjs'
import { findBuildTool } from './apk-signer.mjs'

const MOBILE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../apps/mobile'
)
const require = createRequire(import.meta.url)
const { ANDROID_BLOCKED_PERMISSIONS, isAllowedAndroidPermission } = require(
  join(MOBILE_DIR, 'constants/androidPermissions.cjs')
)
const NODE_MODULES_DIRS = [
  join(MOBILE_DIR, 'node_modules'),
  join(MOBILE_DIR, '../../node_modules')
]
const LIBRARY_MANIFEST = join('android', 'src', 'main', 'AndroidManifest.xml')

function permissionStatus(name) {
  if (isAllowedAndroidPermission(name)) {
    return 'allowed'
  }
  return ANDROID_BLOCKED_PERMISSIONS.includes(name) ? 'blocked' : 'unexpected'
}

function manifestPermissions(xml) {
  return [...xml.matchAll(/<uses-permission[^>]*android:name="([^"]+)"/g)].map(
    (match) => match[1]
  )
}

function dependencyManifest(name) {
  return NODE_MODULES_DIRS.map((dir) => join(dir, name, LIBRARY_MANIFEST)).find(
    (manifest) => existsSync(manifest)
  )
}

// Before a build: the permissions each native dependency in package.json
// merges into the manifest. Maven libraries (androidx, media3, react-android)
// only show up in the built APK.
function libraryPermissions() {
  const pkg = JSON.parse(readFileSync(join(MOBILE_DIR, 'package.json'), 'utf8'))
  return Object.keys(pkg.dependencies ?? {}).flatMap((library) => {
    const manifest = dependencyManifest(library)
    if (!manifest) {
      return []
    }
    return manifestPermissions(readFileSync(manifest, 'utf8')).map((name) => ({
      library,
      name,
      status: permissionStatus(name)
    }))
  })
}

// After a build: what the APK really requests once every manifest is merged.
function apkPermissions(apkPath) {
  const output = execFileSync(
    findBuildTool('aapt2'),
    ['dump', 'permissions', apkPath],
    { encoding: 'utf8' }
  )
  return parsePermissions(output).map((permission) => ({
    ...permission,
    status: permissionStatus(permission.name)
  }))
}

function unexpected(permissions) {
  return permissions.filter((permission) => permission.status === 'unexpected')
}

// In the APK a blocked permission is a failure too: the block did not apply.
function notAllowed(permissions) {
  return permissions.filter((permission) => permission.status !== 'allowed')
}

function assertApkPermissions(apkPath) {
  const extra = notAllowed(apkPermissions(apkPath))
  if (extra.length === 0) {
    return
  }
  throw new Error(
    `The APK requests permissions Satsigner does not allow:\n${extra
      .map((permission) => `  ${permission.name}`)
      .join('\n')}\n` +
      'Block them in apps/mobile/constants/androidPermissions.cjs, or allow them there if Satsigner needs them.'
  )
}

export {
  apkPermissions,
  assertApkPermissions,
  libraryPermissions,
  notAllowed,
  permissionStatus,
  unexpected
}
