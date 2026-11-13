import { notAllowed, permissionText } from './apk-review.mjs'
import {
  apkPermissions,
  libraryPermissions,
  unexpected
} from './permission-check.mjs'

const apkPath = process.argv.at(2)

function printPermissions(permissions, describe) {
  for (const permission of permissions) {
    console.log(`  ${permission.status.padEnd(10)} ${describe(permission)}`)
  }
}

console.log('Before the build: permissions native dependencies declare')
const libraries = libraryPermissions()
printPermissions(libraries, ({ library, name }) => `${name} (${library})`)

if (apkPath) {
  console.log(`\nAfter the build: permissions ${apkPath} requests`)
}
const apk = apkPath ? apkPermissions(apkPath) : []
printPermissions(apk, permissionText)

const failures = [...unexpected(libraries), ...notAllowed(apk)]
if (failures.length > 0) {
  console.error(
    '\nAllow or block these in apps/mobile/constants/androidPermissions.cjs:'
  )
  for (const { name } of failures) {
    console.error(`  ${name}`)
  }
  process.exit(1)
}
console.log('\nok      Only allowed permissions')
