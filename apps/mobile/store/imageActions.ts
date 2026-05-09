import { create } from 'zustand'

import { type ImageExifData } from '@/utils/imageExif'

export type SelectedImageMeta = {
  uri: string
  width: number
  height: number
  fileSize?: number
  contentType?: string
  filename?: string
  exif?: ImageExifData | null
}

type ImageActionsState = {
  selectedImage: SelectedImageMeta | null
  setSelectedImage: (image: SelectedImageMeta) => void
  clearSelectedImage: () => void
}

export const useImageActionsStore = create<ImageActionsState>()((set) => ({
  clearSelectedImage: () => set({ selectedImage: null }),
  selectedImage: null,
  setSelectedImage: (image) => set({ selectedImage: image })
}))
