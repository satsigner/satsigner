import { text, type TextFontSize, type TextFontWeight } from '@/styles/sizes'

function isTextFontSize(key: string): key is TextFontSize {
  return key in text.fontSize
}

function isTextFontWeight(key: string): key is TextFontWeight {
  return key in text.fontWeight
}

export function textSizesAscending() {
  return Object.keys(text.fontSize)
    .filter(isTextFontSize)
    .map((size) => ({ px: text.fontSize[size], size }))
    .toSorted((a, b) => a.px - b.px)
}

export function textWeightsAscending() {
  return Object.keys(text.fontWeight)
    .filter(isTextFontWeight)
    .map((weight) => ({ value: Number(text.fontWeight[weight]), weight }))
    .toSorted((a, b) => a.value - b.value)
}
