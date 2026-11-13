import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '../..')
const require = createRequire(import.meta.url)
const { getAndroidVersionCode } = require(
  path.join(REPO_ROOT, 'apps/mobile/constants/versionCode.cjs')
)

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/

const PACKAGE_FILES = [
  'package.json',
  'apps/mobile/package.json',
  'apps/docs/package.json',
  'tools/release/package.json'
]
const APP_CONFIG = 'apps/mobile/app.config.ts'
const CHANGELOG = 'CHANGELOG.md'
export const PACKAGE_VERSION_PATTERN = /("version":\s*")([^"]*)(")/
export const APP_VERSION_PATTERN = /(const APP_VERSION = ')([^']*)(')/

const BUMPS = {
  major: ([major]) => `${major + 1}.0.0`,
  minor: ([major, minor]) => `${major}.${minor + 1}.0`,
  patch: ([major, minor, patch]) => `${major}.${minor}.${patch + 1}`
}
export const VERSION_PARTS = Object.keys(BUMPS)

export function bumpVersion(version, part) {
  const match = SEMVER_PATTERN.exec(version)
  if (!match) {
    throw new Error(`Version "${version}" is not major.minor.patch`)
  }
  if (!Object.hasOwn(BUMPS, part)) {
    throw new Error(`Unknown version part "${part}"`)
  }
  return BUMPS[part](match.slice(1).map(Number))
}

export function replaceVersion(source, pattern, version) {
  if (!pattern.test(source)) {
    throw new Error('Version field not found')
  }
  return source.replace(pattern, `$1${version}$3`)
}

export function hasChangelogSection(changelog, version) {
  return changelog.includes(`## [${version}]`)
}

function readRepoFile(file) {
  return readFile(path.join(REPO_ROOT, file), 'utf8')
}

async function readAppVersion() {
  const pkg = JSON.parse(await readRepoFile('apps/mobile/package.json'))
  return pkg.version
}

async function readFileVersions() {
  const packages = await Promise.all(
    PACKAGE_FILES.map(async (file) => ({
      file,
      version: JSON.parse(await readRepoFile(file)).version
    }))
  )
  const config = APP_VERSION_PATTERN.exec(await readRepoFile(APP_CONFIG))
  return [...packages, { file: APP_CONFIG, version: config?.[2] ?? '' }]
}

export async function versionStatus() {
  const version = await readAppVersion()
  const files = await readFileVersions()
  const changelog = await readRepoFile(CHANGELOG)
  return {
    changelogReady: hasChangelogSection(changelog, version),
    files,
    inSync: files.every((entry) => entry.version === version),
    next: Object.fromEntries(
      VERSION_PARTS.map((part) => [part, bumpVersion(version, part)])
    ),
    version,
    versionCode: getAndroidVersionCode(version)
  }
}

export async function writeVersion(part) {
  if (!VERSION_PARTS.includes(part)) {
    throw new Error(`Unknown version part "${part}"`)
  }
  const version = bumpVersion(await readAppVersion(), part)
  const targets = [
    ...PACKAGE_FILES.map((file) => ({
      file,
      pattern: PACKAGE_VERSION_PATTERN
    })),
    { file: APP_CONFIG, pattern: APP_VERSION_PATTERN }
  ]
  const updated = await Promise.all(
    targets.map(async ({ file, pattern }) => ({
      file,
      source: replaceVersion(await readRepoFile(file), pattern, version)
    }))
  )
  await Promise.all(
    updated.map(({ file, source }) =>
      writeFile(path.join(REPO_ROOT, file), source)
    )
  )
  return versionStatus()
}
