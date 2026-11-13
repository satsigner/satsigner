import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import {
  KEY_ALIAS,
  hasRotation,
  keystoreFiles,
  lineageFile,
  readKeystorePassword,
  releaseDir
} from './keystore.mjs'

const OLD_PASS_ENV = 'SATSIGNER_OLD_KEYSTORE_PASS'
const NEW_PASS_ENV = 'SATSIGNER_NEW_KEYSTORE_PASS'
// aapt2 ships as aapt2.exe on Windows. apksigner ships as a .bat there, which
// execFile cannot run, so it is reported as missing.
const EXECUTABLE_SUFFIX = process.platform === 'win32' ? '.exe' : ''

function androidHome(env = process.env) {
  return (
    env.ANDROID_HOME ||
    env.ANDROID_SDK_ROOT ||
    join(homedir(), 'Library', 'Android', 'sdk')
  )
}

function compareVersions(left, right) {
  const a = left.split('.').map(Number)
  const b = right.split('.').map(Number)
  const index = a.findIndex((part, i) => part !== (b[i] ?? 0))
  return index === -1 ? 0 : a[index] - (b[index] ?? 0)
}

function findBuildTool(tool, env = process.env) {
  const buildTools = join(androidHome(env), 'build-tools')
  if (!existsSync(buildTools)) {
    throw new Error(`No Android build-tools at ${buildTools}`)
  }
  const executable = `${tool}${EXECUTABLE_SUFFIX}`
  const newest = readdirSync(buildTools)
    .filter((name) => existsSync(join(buildTools, name, executable)))
    .toSorted(compareVersions)
    .at(-1)
  if (!newest) {
    throw new Error(`No ${executable} under ${buildTools}`)
  }
  return join(buildTools, newest, executable)
}

function findApksigner(env = process.env) {
  return findBuildTool('apksigner', env)
}

function signerArgs(dir, passEnv) {
  return [
    '--ks',
    keystoreFiles(dir).keystore,
    '--ks-type',
    'PKCS12',
    '--ks-key-alias',
    KEY_ALIAS,
    '--ks-pass',
    `env:${passEnv}`,
    '--key-pass',
    `env:${passEnv}`
  ]
}

function signerEnv(oldDir, newDir) {
  return {
    ...process.env,
    [NEW_PASS_ENV]: readKeystorePassword(newDir),
    [OLD_PASS_ENV]: readKeystorePassword(oldDir)
  }
}

// APK Signature Scheme v3 lineage: the old key signs the new certificate, so
// Android installs updates from the new key over the old one.
function writeLineage(dir = releaseDir) {
  const nextDir = join(dir, 'next')
  const out = lineageFile(dir)
  const pending = `${out}.tmp`
  try {
    execFileSync(
      findApksigner(),
      [
        'rotate',
        '--out',
        pending,
        '--old-signer',
        ...signerArgs(dir, OLD_PASS_ENV),
        '--new-signer',
        ...signerArgs(nextDir, NEW_PASS_ENV)
      ],
      { env: signerEnv(dir, nextDir), stdio: ['ignore', 'inherit', 'inherit'] }
    )
    renameSync(pending, out)
  } finally {
    rmSync(pending, { force: true })
  }
}

function signWithLineage(apkPath, dir = releaseDir) {
  const nextDir = join(dir, 'next')
  const pending = `${apkPath}.rotated`
  try {
    execFileSync(
      findApksigner(),
      [
        'sign',
        ...signerArgs(dir, OLD_PASS_ENV),
        '--next-signer',
        ...signerArgs(nextDir, NEW_PASS_ENV),
        '--lineage',
        lineageFile(dir),
        '--out',
        pending,
        apkPath
      ],
      { env: signerEnv(dir, nextDir), stdio: ['ignore', 'inherit', 'inherit'] }
    )
    renameSync(pending, apkPath)
    rmSync(`${pending}.idsig`, { force: true })
  } finally {
    rmSync(pending, { force: true })
  }
}

function applyKeyRotation(apkPath, dir = releaseDir) {
  if (!hasRotation(dir)) {
    return false
  }
  signWithLineage(apkPath, dir)
  return true
}

export { applyKeyRotation, findApksigner, findBuildTool, writeLineage }
