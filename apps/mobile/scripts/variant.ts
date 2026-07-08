#!/usr/bin/env node
/**
 * Per-branch / per-PR app variant builder.
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

import { APP_VARIANT_PRODUCTION } from '../constants/variant.ts'
import {
  getVariantAppName,
  getVariantPackageId,
  sanitizePackageSegment
} from '../utils/variantSuffix.ts'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const MOBILE_DIR = join(SCRIPT_DIR, '..')

type VariantArgs = {
  apk: boolean
  device: string[]
  ios: boolean
  plain: boolean
  prebuildOnly: boolean
  prod: boolean
  release: boolean
  suffix: string | undefined
}

function parseArgs(argv: string[]) {
  const args: VariantArgs = {
    apk: false,
    device: [],
    ios: false,
    plain: false,
    prebuildOnly: false,
    prod: false,
    release: false,
    suffix: undefined
  }

  const remaining = [...argv]

  while (remaining.length > 0) {
    const arg = remaining.shift()

    if (!arg) {
      continue
    }

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
        args.suffix = remaining.shift()
        break
      default:
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

function resolveSuffix(args: VariantArgs) {
  if (args.plain) {
    return { raw: '', source: 'plain' }
  }

  if (args.suffix !== undefined) {
    return { raw: args.suffix, source: 'flag' }
  }

  const branch = getGitBranch()
  return { raw: branch, source: `branch ${branch || '(unknown)'}` }
}

function run(
  command: string,
  commandArgs: string[],
  env: NodeJS.ProcessEnv,
  cwd = MOBILE_DIR
) {
  const result = spawnSync(command, commandArgs, {
    cwd,
    env,
    stdio: 'inherit'
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function buildApk({
  buildType,
  env,
  packageId,
  segment,
  variant
}: {
  buildType: 'debug' | 'release'
  env: NodeJS.ProcessEnv
  packageId: string
  segment: string
  variant: string
}) {
  const androidDir = join(MOBILE_DIR, 'android')
  const gradleTask =
    buildType === 'release' ? 'assembleRelease' : 'assembleDebug'

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

  const variantLabel = variant === APP_VARIANT_PRODUCTION ? 'prod' : 'dev'
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

function main() {
  const args = parseArgs(process.argv.slice(2))
  const { raw, source } = resolveSuffix(args)
  const isDev = !args.prod
  const segment = sanitizePackageSegment(raw)
  const variant = args.prod ? APP_VARIANT_PRODUCTION : 'development'
  const buildType = args.release ? 'release' : 'debug'
  const packageId = getVariantPackageId(isDev, raw)
  const appName = getVariantAppName(isDev, raw)

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

main()
