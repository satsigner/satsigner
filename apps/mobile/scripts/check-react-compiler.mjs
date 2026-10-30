#!/usr/bin/env node
/**
 * Fails when React Compiler cannot compile a component or hook.
 *
 * Production builds run the compiler with panicThreshold 'none', so a bailout
 * never breaks the build: the function silently ships without memoization.
 * This runs the same plugin and options as babel-preset-expo over every
 * source file and reports each function it skips.
 *
 * Opt a function out on purpose with a 'use no memo' directive.
 *
 * Usage (apps/mobile):
 *   pnpm check:compiler
 *   pnpm check:compiler components/SSButton.tsx hooks/useLND.ts
 */

import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const babel = require('@babel/core')

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SKIPPED_DIRS = new Set([
  '.expo',
  '__mocks__',
  'android',
  'assets',
  'dist',
  'ios',
  'node_modules',
  'scripts',
  'tests'
])
const SOURCE_FILE = /\.(jsx?|tsx?)$/
const NON_APP_FILE = /\.(d|test|spec|stories)\.(jsx?|tsx?)$/
const FAILURE_KINDS = new Set([
  'CompileError',
  'CompileUnexpectedThrow',
  'PipelineError'
])

function listSourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return SKIPPED_DIRS.has(entry.name) ? [] : listSourceFiles(entryPath)
    }
    return SOURCE_FILE.test(entry.name) && !NON_APP_FILE.test(entry.name)
      ? [entryPath]
      : []
  })
}

function describeEvent(event) {
  const detail = event.detail ?? {}
  const reason = detail.reason ?? detail.options?.reason ?? event.data ?? ''
  const loc = detail.loc ?? detail.primaryLocation?.() ?? event.fnLoc
  return { line: loc?.start?.line ?? event.fnLoc?.start?.line, reason }
}

function compileFile(file) {
  const failures = []
  babel.transformSync(readFileSync(file, 'utf8'), {
    babelrc: false,
    configFile: false,
    filename: file,
    parserOpts: { plugins: ['jsx', 'typescript'] },
    plugins: [
      [
        'babel-plugin-react-compiler',
        {
          logger: {
            logEvent(_filename, event) {
              if (FAILURE_KINDS.has(event.kind)) {
                failures.push(describeEvent(event))
              }
            }
          },
          panicThreshold: 'none',
          target: '19'
        }
      ]
    ]
  })
  return failures
}

const requestedFiles = process.argv
  .slice(2)
  .map((file) => path.resolve(APP_DIR, file))
const files =
  requestedFiles.length > 0 ? requestedFiles : listSourceFiles(APP_DIR)

const report = files.flatMap((file) =>
  compileFile(file).map(({ line, reason }) => ({
    file: path.relative(APP_DIR, file).replaceAll('\\', '/'),
    line,
    reason
  }))
)

if (report.length === 0) {
  process.stdout.write('React Compiler compiled every component and hook.\n')
  process.exit(0)
}

for (const { file, line, reason } of report) {
  process.stderr.write(`${file}:${line}  ${reason}\n`)
}
process.stderr.write(
  `\n${report.length} React Compiler bailout(s). Rewrite the code above, or add 'use no memo' if the opt-out is intentional.\n`
)
process.exit(1)
