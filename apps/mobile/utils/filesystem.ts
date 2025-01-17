import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'

type saveFileProps = {
  filename: string
  fileContent: string
  dialogTitle: string
  mimeType: string
}

export async function shareFile({
  filename,
  fileContent,
  dialogTitle,
  mimeType
}: saveFileProps) {
  console.log(fileContent)
  const fileUri = FileSystem.documentDirectory + filename

  await FileSystem.writeAsStringAsync(fileUri, fileContent)
  await Sharing.shareAsync(fileUri, { mimeType, dialogTitle })
}
