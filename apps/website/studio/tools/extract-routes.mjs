/* app/**.tsx -> generated/routes.json
   One entry per route file: URL path, params, navigation targets, SS* components used,
   i18n keys referenced. Feeds the flow diagram and the coverage report. */

import fs from 'node:fs'
import path from 'node:path'
import { walk, writeOut } from './lib.mjs'

const NAV = /router\.(push|navigate|replace)|href|pathname/

export function extractRoutes({ ts, appDir, outDir }) {
  const appRoot = path.join(appDir, 'app')
  const files = walk(appRoot, (f) => f.endsWith('.tsx'))
  const routes = []

  for (const file of files) {
    const rel = path.relative(appRoot, file)
    const base = path.basename(rel, '.tsx')
    const src = fs.readFileSync(file, 'utf8')
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const components = new Set()
    const targets = new Set()
    const strings = new Set()

    const visit = (node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText()
        if (/^SS/.test(tag)) components.add(tag)
      }
      if (ts.isCallExpression(node)) {
        const callee = node.expression.getText()
        if (callee === 't' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) strings.add(node.arguments[0].text)
        if (/router\.(push|navigate|replace)$/.test(callee) && node.arguments[0]) targets.add(target(ts, node.arguments[0]))
      }
      if (ts.isPropertyAssignment(node) && /^(pathname|href)$/.test(node.name.getText())) targets.add(target(ts, node.initializer))
      if (ts.isJsxAttribute(node) && node.name.getText() === 'href' && node.initializer) targets.add(target(ts, node.initializer))
      ts.forEachChild(node, visit)
    }
    if (NAV.test(src) || /<SS/.test(src) || /\bt\(/.test(src)) visit(sf)
    targets.delete(null)

    routes.push({
      id: routeId(rel),
      path: routePath(rel),
      file: `app/${rel}`,
      layout: base === '_layout',
      group: (rel.match(/\(([^)]+)\)/g) || []).map((g) => g.slice(1, -1)),
      params: [...rel.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]),
      components: [...components].sort(),
      targets: [...targets].sort(),
      strings: [...strings].sort()
    })
  }

  routes.sort((a, b) => a.path.localeCompare(b.path) || a.file.localeCompare(b.file))
  writeOut(path.join(outDir, 'routes.json'), JSON.stringify(routes, null, 2) + '\n')
  return { count: routes.filter((r) => !r.layout).length, layouts: routes.filter((r) => r.layout).length }
}

// Strip groups and index, keep dynamic segments as :param.
function routePath(rel) {
  const parts = rel.replace(/\.tsx$/, '').split('/').filter((p) => !/^\(.*\)$/.test(p))
  if (parts.at(-1) === 'index' || parts.at(-1) === '_layout') parts.pop()
  return '/' + parts.map((p) => p.replace(/^\[(\.\.\.)?(.+)\]$/, ':$2')).join('/')
}

const routeId = (rel) => rel.replace(/\.tsx$/, '').replace(/\([^)]*\)\/?/g, '').replace(/[[\]]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'index'

// Turn a router argument into a normalised path. Template slots become :param.
function target(ts, node) {
  if (ts.isJsxExpression(node)) node = node.expression
  if (!node) return null
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return clean(node.text)
  if (ts.isTemplateExpression(node)) {
    let s = node.head.text
    for (const span of node.templateSpans) s += ':' + span.expression.getText().split('.').pop().replace(/\W/g, '') + span.literal.text
    return clean(s)
  }
  if (ts.isObjectLiteralExpression(node)) {
    const p = node.properties.find((p) => p.name?.getText() === 'pathname')
    return p ? target(ts, p.initializer) : null
  }
  return null
}

const clean = (s) => s.replace(/\([^)]*\)\/?/g, '').replace(/\/+/g, '/').replace(/\/$/, '') || '/'
