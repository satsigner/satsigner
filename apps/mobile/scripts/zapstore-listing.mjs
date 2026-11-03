import { existsSync, readdirSync, readFileSync } from 'fs'
import path from 'path'

const DESCRIPTION_FILE = 'description.md'
const SUMMARY_FILE = 'summary.txt'
const SCREENSHOTS_DIR = 'screenshots'
const IMAGE_EXTENSIONS = new Set(['.jpeg', '.jpg', '.png', '.webp'])

function listingImages(fileNames) {
  return fileNames
    .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .toSorted()
}

function readText(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, 'utf8').trim() : ''
}

function readListing(dir) {
  const screenshotsDir = path.join(dir, SCREENSHOTS_DIR)
  const images = existsSync(screenshotsDir)
    ? listingImages(readdirSync(screenshotsDir)).map((name) =>
        path.join(screenshotsDir, name)
      )
    : []
  return {
    description: readText(path.join(dir, DESCRIPTION_FILE)),
    images,
    summary: readText(path.join(dir, SUMMARY_FILE))
  }
}

// zsp ignores every yaml when handed a bare APK, so the listing travels in a
// config whose release_source is the local APK. YAML 1.2 is a superset of
// JSON, which spares a yaml dependency and escaping a multi-line description.
function publishConfig({ apkPath, description, images, repository, summary }) {
  const config = { release_source: apkPath, repository }
  if (summary) {
    config.summary = summary
  }
  if (description) {
    config.description = description
  }
  if (images.length > 0) {
    config.images = images
  }
  return JSON.stringify(config, null, 2)
}

export { listingImages, publishConfig, readListing }
