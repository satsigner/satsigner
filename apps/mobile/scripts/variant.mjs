#!/usr/bin/env node
/**
 * Per-branch / per-PR app variant builder.
 *
 * Resolves a unique suffix (from a flag or the current git branch), sets it as
 * an env var, runs `expo prebuild --clean`, and optionally builds/installs the
 * app. Each suffix produces a distinct Android package id, so multiple builds
 * coexist on one device — each with its own isolated storage (MMKV, SQLite,
 * secure store).
 *
 * Usage:
 *   pnpm variant                              current git branch -> unique id
 *   pnpm variant -- --suffix pr453            explicit suffix
 *   pnpm variant -- --plain                   no suffix (today's behavior)
 *   pnpm variant -- --release                 standalone release build
 *   pnpm variant -- --prod --suffix pr453     production variant + suffix
 *   pnpm variant -- --prebuild-only           stop after prebuild
 *   pnpm variant -- --apk --suffix pr453 --release   named APK in dist/apks
 *   pnpm variant -- --ios                     run on iOS instead of Android
 *   pnpm variant -- --device Pixel_9          passthrough flags to expo
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const MOBILE_DIR = join(SCRIPT_DIR, '..')

function parseArgs(argv) {
  const args = {
    apk: false,
    device: [],
    ios: false,
    plain: false,
    prebuildOnly: false,
    prod: false,
    release: false,
    suffix: undefined
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--apk':
        args.apk = true
        break
      case '--branch':
        break
      case '--ios':
        args.ios = true
        break
      case '--plain':
        args.plain = true
        break
      case '--prebuild-only':
        args.prebuildOnly = true
        break
      case '--prod':
        args.prod = true
        break
      case '--release':
        args.release = true
        break
      case '--suffix':
        args.suffix = argv[++i]
        break
      default:
        // Everything else (e.g. --device, Pixel_9) is passed through to expo.
        args.device.push(arg)
    }
  }

  return args
}

function getGitBranch() {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: MOBILE_DIR,
      encoding: 'utf8'
    }).trim()
  } catch {
    return ''
  }
}

// Mirror the sanitization in app.config.ts so printed/copied names match the
// values baked into the native project.
function sanitizePackageSegment(raw) {
  const segment = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24)

  if (!segment) {
    return ''
  }

  return /^[a-z]/.test(segment) ? segment : `b_${segment}`
}

function resolveSuffix(args) {
  if (args.plain) {
    return { raw: '', source: 'plain' }
  }

  if (args.suffix !== undefined) {
    return { raw: args.suffix, source: 'flag' }
  }

  const branch = getGitBranch()
  return { raw: branch, source: `branch ${branch || '(unknown)'}` }
}

function run(command, commandArgs, env, cwd = MOBILE_DIR) {
  const result = spawnSync(command, commandArgs, {
    cwd,
    env,
    stdio: 'inherit'
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const { raw, source } = resolveSuffix(args)
  const segment = sanitizePackageSegment(raw)
  const variant = args.prod ? 'production' : 'development'
  const buildType = args.release ? 'release' : 'debug'

  const base = args.prod
    ? 'com.satsigner.satsigner'
    : 'com.satsigner.satsigner.dev'
  const packageId = segment ? `${base}.${segment}` : base
  const appName = args.prod
    ? segment
      ? `${segment} (Prod)`
      : 'satsigner'
    : segment
      ? `${segment} (Dev)`
      : 'satsigner (Dev)'

  console.log('')
  console.log(`Variant: ${variant}`)
  console.log(`Suffix:  ${segment || '(none)'} (from ${source})`)
  console.log(`Package: ${packageId}`)
  console.log(`Name:    ${appName}`)
  console.log('')

  const env = {
    ...process.env,
    APP_VARIANT: variant,
    APP_VARIANT_SUFFIX: raw
  }

  const platform = args.ios ? 'ios' : 'android'

  // `expo prebuild --clean` deletes the native folder with a plain rmdir that
  // fails on non-empty nested build artifacts (e.g. android/app/.cxx). Remove
  // the folder ourselves first with a recursive/force delete so prebuild starts
  // from a clean slate.
  rmSync(join(MOBILE_DIR, platform), { force: true, recursive: true })

  run('npx', ['expo', 'prebuild', '--clean', '--platform', platform], env)

  if (args.prebuildOnly) {
    console.log('\nPrebuild complete (--prebuild-only).')
    return
  }

  if (args.apk) {
    if (args.ios) {
      console.error('\n--apk is Android-only.')
      process.exit(1)
    }
    buildApk({ buildType, env, packageId, segment, variant })
    return
  }

  const runArgs = ['expo', `run:${platform}`]
  if (args.release) {
    runArgs.push('--variant', 'release')
  }
  runArgs.push(...args.device)

  run('npx', runArgs, env)
}

function buildApk({ buildType, env, packageId, segment, variant }) {
  const androidDir = join(MOBILE_DIR, 'android')
  const gradleTask = buildType === 'release' ? 'assembleRelease' : 'assembleDebug'

  run('./gradlew', [gradleTask], env, androidDir)

  const builtApk = join(
    androidDir,
    'app',
    'build',
    'outputs',
    'apk',
    buildType,
    `app-${buildType}.apk`
  )

  const outDir = join(MOBILE_DIR, 'dist', 'apks')
  mkdirSync(outDir, { recursive: true })

  const variantLabel = variant === 'production' ? 'prod' : 'dev'
  const suffixLabel = segment || 'plain'
  const outApk = join(
    outDir,
    `satsigner-${variantLabel}-${suffixLabel}-${buildType}.apk`
  )

  copyFileSync(builtApk, outApk)

  console.log('')
  console.log(`APK:     ${outApk}`)
  console.log(`Package: ${packageId}`)
  console.log(`Install: adb install "${outApk}"`)
}

main()
