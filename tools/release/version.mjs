import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '../..')
const require = createRequire(import.meta.url)
const { getAndroidVersionCode } = require(
  path.join(REPO_ROOT, 'apps/mobile/constants/versionCode.cjs')
)

const PACKAGE_FILES = [
  'package.json',
  'apps/mobile/package.json',
  'apps/docs/package.json'
]
const APP_CONFIG = 'apps/mobile/app.config.ts'
const CHANGELOG = 'CHANGELOG.md'
export const APP_VERSION_PATTERN = /const APP_VERSION = '([^']*)'/

export function hasChangelogSection(changelog, version) {
  return changelog.includes(`## [${version}]`)
}

function readRepoFile(file) {
  return readFile(path.join(REPO_ROOT, file), 'utf8')
}

async function readFileVersions() {
  const packages = await Promise.all(
    PACKAGE_FILES.map(async (file) => ({
      file,
      version: JSON.parse(await readRepoFile(file)).version
    }))
  )
  const config = APP_VERSION_PATTERN.exec(await readRepoFile(APP_CONFIG))
  return [...packages, { file: APP_CONFIG, version: config?.[1] ?? '' }]
}

export async function versionStatus() {
  const files = await readFileVersions()
  const { version } = files.find(
    (entry) => entry.file === 'apps/mobile/package.json'
  )
  const changelog = await readRepoFile(CHANGELOG)
  return {
    changelogReady: hasChangelogSection(changelog, version),
    files,
    version,
    versionCode: getAndroidVersionCode(version)
  }
}
