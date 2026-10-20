#!/usr/bin/env node
/* Run every extractor against the SatSigner app.
   Usage: node studio/tools/extract-all.mjs [--app ../satsigner/apps/mobile] */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadStyles, loadTs, writeOut } from './lib.mjs'
import { extractTokens } from './extract-tokens.mjs'
import { extractIcons } from './extract-icons.mjs'
import { extractStyles } from './extract-styles.mjs'
import { extractRoutes } from './extract-routes.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const studio = path.resolve(here, '..')
const argApp = process.argv.indexOf('--app')
const appDir = path.resolve(argApp > -1 ? process.argv[argApp + 1] : path.join(studio, '../../satsigner/apps/mobile'))
const outDir = path.join(studio, 'generated')

if (!fs.existsSync(path.join(appDir, 'app'))) {
  console.error(`App not found at ${appDir}. Pass --app <path to apps/mobile>.`)
  process.exit(1)
}

console.log(`Extracting from ${appDir}`)
const ts = loadTs(appDir)
const styles = loadStyles(ts, appDir)
const ctx = { ts, appDir, outDir, styles }

extractTokens(ctx)
const icons = extractIcons(ctx)
const css = extractStyles(ctx)
const routes = extractRoutes(ctx)

const en = JSON.parse(fs.readFileSync(path.join(appDir, 'locales/en.json'), 'utf8'))
writeOut(path.join(outDir, 'strings.js'),
  `/* GENERATED from apps/mobile/locales/en.json. Use t('a.b.c'). */\n\nconst ssStrings = ${JSON.stringify(en, null, 1)}\n\n` +
  `// en.json mixes nesting with dotted keys ("currency.sats"), so try every split of the path.\n` +
  `function tLookup(node, parts) {\n  if (!parts.length) return node\n  if (node == null || typeof node !== 'object') return undefined\n` +
  `  for (let i = parts.length; i > 0; i--) {\n    const k = parts.slice(0, i).join('.')\n    if (k in node) {\n      const v = tLookup(node[k], parts.slice(i))\n      if (v !== undefined) return v\n    }\n  }\n}\n\n` +
  `function t(key, vars = {}) {\n  const v = tLookup(ssStrings, key.split('.'))\n` +
  `  return typeof v === 'string' ? v.replace(/%\\{(\\w+)\\}/g, (_, k) => vars[k] ?? '') : key\n}\n`)

const warnings = [...icons.warnings, ...css.warnings]
writeOut(path.join(outDir, 'extract-warnings.txt'), warnings.join('\n') + '\n')
console.log(`\n${icons.count} icons, ${css.rules} style rules, ${routes.count} routes (+${routes.layouts} layouts), ${warnings.length} warnings`)
