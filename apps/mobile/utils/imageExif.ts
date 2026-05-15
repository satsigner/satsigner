export type ImageExifData = {
  artist?: string
  copyright?: string
  description?: string
  software?: string
  byline?: string
  city?: string
  country?: string
  headline?: string
  keywords?: string[]
  make?: string
  model?: string
  lens?: string
  exposureTime?: number
  fNumber?: number
  iso?: number
  focalLength?: number
  dateTimeOriginal?: Date
  latitude?: number
  longitude?: number
  altitude?: number
}

const TIFF_BYTE = 1
const TIFF_ASCII = 2
const TIFF_SHORT = 3
const TIFF_LONG = 4
const TIFF_RATIONAL = 5
const TIFF_SRATIONAL = 10

const TIFF_TYPE_SIZE: Record<number, number> = {
  [TIFF_BYTE]: 1,
  [TIFF_ASCII]: 1,
  [TIFF_SHORT]: 2,
  [TIFF_LONG]: 4,
  [TIFF_RATIONAL]: 8,
  [TIFF_SRATIONAL]: 8
}

const TAG_IMAGE_DESCRIPTION = 0x010e
const TAG_MAKE = 0x010f
const TAG_MODEL = 0x0110
const TAG_SOFTWARE = 0x0131
const TAG_ARTIST = 0x013b
const TAG_COPYRIGHT = 0x8298
const TAG_EXIF_IFD = 0x8769
const TAG_GPS_IFD = 0x8825

const TAG_EXPOSURE_TIME = 0x829a
const TAG_F_NUMBER = 0x829d
const TAG_ISO = 0x8827
const TAG_DATE_TIME_ORIGINAL = 0x9003
const TAG_FOCAL_LENGTH = 0x920a
const TAG_LENS_MODEL = 0xa434

const TAG_GPS_LAT_REF = 0x0001
const TAG_GPS_LAT = 0x0002
const TAG_GPS_LON_REF = 0x0003
const TAG_GPS_LON = 0x0004
const TAG_GPS_ALT_REF = 0x0005
const TAG_GPS_ALT = 0x0006

function readUint16(view: DataView, offset: number, le: boolean): number {
  return view.getUint16(offset, le)
}

function readUint32(view: DataView, offset: number, le: boolean): number {
  return view.getUint32(offset, le)
}

function readRational(view: DataView, offset: number, le: boolean): number {
  const num = readUint32(view, offset, le)
  const den = readUint32(view, offset + 4, le)
  return den !== 0 ? num / den : 0
}

function readAscii(view: DataView, offset: number, count: number): string {
  const raw = Array.from({ length: count - 1 }, (_, i) =>
    view.getUint8(offset + i)
  )
  const nullIdx = raw.indexOf(0)
  const bytes = nullIdx !== -1 ? raw.slice(0, nullIdx) : raw
  return bytes
    .map((b) => String.fromCharCode(b))
    .join('')
    .trim()
}

type IFDValues = Record<number, number | string | number[] | undefined>

function readIFD(
  view: DataView,
  ifdOffset: number,
  tiffStart: number,
  le: boolean
): IFDValues {
  const result: IFDValues = {}
  const entryCount = readUint16(view, ifdOffset, le)

  for (const i of Array.from({ length: entryCount }, (_, idx) => idx)) {
    const entryOffset = ifdOffset + 2 + i * 12
    if (entryOffset + 12 > view.byteLength) {
      break
    }

    const tag = readUint16(view, entryOffset, le)
    const type = readUint16(view, entryOffset + 2, le)
    const count = readUint32(view, entryOffset + 4, le)
    const typeSize = TIFF_TYPE_SIZE[type]

    if (!typeSize) {
      continue
    }

    const byteLen = typeSize * count
    const dataOffset =
      byteLen <= 4
        ? entryOffset + 8
        : tiffStart + readUint32(view, entryOffset + 8, le)

    if (dataOffset + byteLen > view.byteLength) {
      continue
    }

    if (type === TIFF_ASCII) {
      result[tag] = readAscii(view, dataOffset, count)
    } else if (type === TIFF_SHORT && count === 1) {
      result[tag] = readUint16(view, dataOffset, le)
    } else if (type === TIFF_SHORT && count > 1) {
      result[tag] = Array.from({ length: count }, (_, j) =>
        readUint16(view, dataOffset + j * 2, le)
      )
    } else if (type === TIFF_LONG && count === 1) {
      result[tag] = readUint32(view, dataOffset, le)
    } else if (type === TIFF_RATIONAL && count === 1) {
      result[tag] = readRational(view, dataOffset, le)
    } else if (type === TIFF_RATIONAL && count === 3) {
      result[tag] = Array.from({ length: 3 }, (_, j) =>
        readRational(view, dataOffset + j * 8, le)
      )
    } else if (type === TIFF_SRATIONAL && count === 1) {
      const num = view.getInt32(dataOffset, le)
      const den = view.getInt32(dataOffset + 4, le)
      result[tag] = den !== 0 ? num / den : 0
    } else if (type === TIFF_BYTE && count === 1) {
      result[tag] = view.getUint8(dataOffset)
    }
  }

  return result
}

function parseGpsCoord(
  values: IFDValues,
  degMinSecTag: number,
  refTag: number,
  negativeRef: string
): number | undefined {
  const dms = values[degMinSecTag]
  if (!Array.isArray(dms) || dms.length < 3) {
    return undefined
  }
  const decimal = dms[0] + dms[1] / 60 + dms[2] / 3600
  const ref = values[refTag]
  return typeof ref === 'string' && ref.toUpperCase() === negativeRef
    ? -decimal
    : decimal
}

function parseExifDate(raw: unknown): Date | undefined {
  if (typeof raw !== 'string') {
    return undefined
  }
  // Format: "YYYY:MM:DD HH:MM:SS"
  const match = raw.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/)
  if (!match) {
    return undefined
  }
  const [, y, mo, d, h, mi, s] = match.map(Number)
  const date = new Date(y, mo - 1, d, h, mi, s)
  return isNaN(date.getTime()) ? undefined : date
}

type IptcData = {
  byline?: string
  city?: string
  country?: string
  headline?: string
  keywords?: string[]
  copyright?: string
}

function parseIptc(view: DataView, offset: number, length: number): IptcData {
  const result: IptcData = {}
  const keywords: string[] = []
  let pos = offset

  while (pos < offset + length - 4) {
    if (view.getUint8(pos) !== 0x1c) {
      pos += 1
      continue
    }
    // skip marker byte + record type byte, then read dataset tag
    const dataset = view.getUint8(pos + 2)
    const dataLen = view.getUint16(pos + 3, false)
    pos += 5 // marker(1) + record(1) + dataset(1) + dataLen(2)

    if (pos + dataLen > view.byteLength) {
      break
    }

    const dataPos = pos
    const text = Array.from({ length: dataLen }, (_, i) =>
      String.fromCharCode(view.getUint8(dataPos + i))
    )
      .join('')
      .trim()
    pos += dataLen

    if (dataset === 5) {
      result.byline = text
    } // By-line (author)
    else if (dataset === 25) {
      keywords.push(text)
    } // Keywords
    else if (dataset === 40) {
      result.headline = text
    } // Headline
    else if (dataset === 55) {
      result.city = text
    } // City
    else if (dataset === 101) {
      result.country = text
    } // Country
    else if (dataset === 116) {
      result.copyright = text
    } // Copyright notice
  }

  if (keywords.length > 0) {
    result.keywords = keywords
  }
  return result
}

function str(v: unknown): string | undefined {
  if (typeof v !== 'string') {
    return undefined
  }
  const trimmed = v.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function num(v: unknown): number | undefined {
  if (typeof v !== 'number' || !isFinite(v)) {
    return undefined
  }
  return v
}

export async function parseImageExif(
  uri: string
): Promise<ImageExifData | null> {
  try {
    const res = await fetch(uri, { headers: { Range: 'bytes=0-131071' } })
    const buffer = await res.arrayBuffer()
    const view = new DataView(buffer)

    // Verify JPEG SOI marker
    if (view.getUint16(0, false) !== 0xffd8) {
      return null
    }

    let exif: ImageExifData | null = null
    let iptc: IptcData | null = null
    let pos = 2

    while (pos < view.byteLength - 4) {
      if (view.getUint8(pos) !== 0xff) {
        break
      }
      const marker = view.getUint16(pos, false)
      const segLen = view.getUint16(pos + 2, false)

      if (marker === 0xffd9 || segLen < 2) {
        break
      } // EOI or bad segment
      const dataStart = pos + 4
      const dataLen = segLen - 2

      // APP1 — may contain EXIF or XMP
      if (marker === 0xffe1 && dataLen > 6) {
        const header = [0, 1, 2, 3, 4, 5]
          .map((i) => view.getUint8(dataStart + i))
          .map((b) => String.fromCharCode(b))
          .join('')

        if (header === 'Exif\0\0') {
          const tiffStart = dataStart + 6
          const byteOrder = view.getUint16(tiffStart, false)
          const le = byteOrder === 0x4949 // II = little-endian

          const ifd0Offset = readUint32(view, tiffStart + 4, le)
          const ifd0 = readIFD(view, tiffStart + ifd0Offset, tiffStart, le)

          const exifIfdOffset = ifd0[TAG_EXIF_IFD]
          const exifIfd =
            typeof exifIfdOffset === 'number'
              ? readIFD(view, tiffStart + exifIfdOffset, tiffStart, le)
              : {}

          const gpsIfdOffset = ifd0[TAG_GPS_IFD]
          const gpsIfd =
            typeof gpsIfdOffset === 'number'
              ? readIFD(view, tiffStart + gpsIfdOffset, tiffStart, le)
              : {}

          const latitude = parseGpsCoord(
            gpsIfd,
            TAG_GPS_LAT,
            TAG_GPS_LAT_REF,
            'S'
          )
          const longitude = parseGpsCoord(
            gpsIfd,
            TAG_GPS_LON,
            TAG_GPS_LON_REF,
            'W'
          )
          const altRaw = gpsIfd[TAG_GPS_ALT]
          const altRef = gpsIfd[TAG_GPS_ALT_REF]
          const altitude =
            typeof altRaw === 'number'
              ? altRef === 1
                ? -altRaw
                : altRaw
              : undefined

          exif = {
            altitude,
            artist: str(ifd0[TAG_ARTIST]),
            copyright: str(ifd0[TAG_COPYRIGHT]),
            dateTimeOriginal: parseExifDate(exifIfd[TAG_DATE_TIME_ORIGINAL]),
            description: str(ifd0[TAG_IMAGE_DESCRIPTION]),
            exposureTime: num(exifIfd[TAG_EXPOSURE_TIME]),
            fNumber: num(exifIfd[TAG_F_NUMBER]),
            focalLength: num(exifIfd[TAG_FOCAL_LENGTH]),
            iso: num(exifIfd[TAG_ISO]),
            latitude,
            lens: str(exifIfd[TAG_LENS_MODEL]),
            longitude,
            make: str(ifd0[TAG_MAKE]),
            model: str(ifd0[TAG_MODEL]),
            software: str(ifd0[TAG_SOFTWARE])
          }
        }
      }

      // APP13 — IPTC/NAA (Photoshop)
      if (marker === 0xffed && dataLen > 14) {
        const header = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
          .map((i) => view.getUint8(dataStart + i))
          .map((b) => String.fromCharCode(b))
          .join('')

        if (header.startsWith('Photoshop 3.0')) {
          iptc = parseIptc(view, dataStart + 14, dataLen - 14)
        }
      }

      pos += 2 + segLen
    }

    if (!exif && !iptc) {
      return null
    }

    const merged: ImageExifData = {
      ...exif,
      byline: iptc?.byline,
      city: iptc?.city,
      copyright: exif?.copyright ?? iptc?.copyright,
      country: iptc?.country,
      headline: iptc?.headline,
      keywords: iptc?.keywords
    }

    const hasData = Object.values(merged).some((v) => v !== undefined)
    return hasData ? merged : null
  } catch {
    return null
  }
}
