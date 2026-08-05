import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { Platform } from 'react-native'

import { sanitizeFilenamePart } from '@/utils/safePath'

type ShareFileProps = {
  filename: string
  fileContent: string
  dialogTitle: string
  mimeType: string
}

function sanitizeExportFilename(filename: string): string {
  const trimmed = filename.trim()
  const lastDot = trimmed.lastIndexOf('.')
  if (lastDot <= 0 || lastDot === trimmed.length - 1) {
    return sanitizeFilenamePart(trimmed, 'export')
  }
  const base = sanitizeFilenamePart(trimmed.slice(0, lastDot), 'export')
  const ext = sanitizeFilenamePart(trimmed.slice(lastDot + 1), 'txt')
  return `${base}.${ext}`
}

export async function shareFile({
  filename,
  fileContent,
  dialogTitle,
  mimeType
}: ShareFileProps) {
  const safeFilename = sanitizeExportFilename(filename)
  const fileUri = `${FileSystem.documentDirectory}${safeFilename}`

  await FileSystem.writeAsStringAsync(fileUri, fileContent)
  await Sharing.shareAsync(fileUri, { dialogTitle, mimeType })
}

type ShareExistingFileProps = {
  fileUri: string
  dialogTitle: string
  mimeType: string
}

export async function shareExistingFile({
  fileUri,
  dialogTitle,
  mimeType
}: ShareExistingFileProps) {
  const available = await Sharing.isAvailableAsync()
  if (!available) {
    throw new Error('Sharing is not available on this device')
  }
  await Sharing.shareAsync(fileUri, { dialogTitle, mimeType })
}

type SaveExistingFileProps = {
  srcUri: string
  filename: string
  dialogTitle: string
  mimeType: string
}

export async function saveExistingFile({
  srcUri,
  filename,
  dialogTitle,
  mimeType
}: SaveExistingFileProps) {
  const safeFilename = sanitizeExportFilename(filename)
  if (Platform.OS === 'android') {
    const permissions =
      await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync()
    if (permissions.granted && permissions.directoryUri) {
      const destinationUri =
        await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          safeFilename,
          mimeType
        )
      const data = await FileSystem.readAsStringAsync(srcUri, {
        encoding: FileSystem.EncodingType.Base64
      })
      await FileSystem.writeAsStringAsync(destinationUri, data, {
        encoding: FileSystem.EncodingType.Base64
      })
      return
    }
  }

  await shareExistingFile({ dialogTitle, fileUri: srcUri, mimeType })
}

export async function saveFile({
  filename,
  fileContent,
  dialogTitle,
  mimeType
}: ShareFileProps) {
  const safeFilename = sanitizeExportFilename(filename)
  if (Platform.OS === 'android') {
    const permissions =
      await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync()
    if (permissions.granted && permissions.directoryUri) {
      const destinationUri =
        await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          safeFilename,
          mimeType
        )
      await FileSystem.writeAsStringAsync(destinationUri, fileContent, {
        encoding: FileSystem.EncodingType.UTF8
      })
      return
    }
  }

  await shareFile({
    dialogTitle,
    fileContent,
    filename: safeFilename,
    mimeType
  })
}

export type PickFileProps = {
  type: 'application/json' | 'text/csv' | 'text/plain' | '*/*'
  encodingOrOptions?: FileSystem.ReadingOptions
}

export async function pickFile({ type, encodingOrOptions }: PickFileProps) {
  const file = await DocumentPicker.getDocumentAsync({ type })
  if (file.canceled || !file.assets?.[0]) {
    return
  }
  return FileSystem.readAsStringAsync(file.assets[0].uri, encodingOrOptions)
}
