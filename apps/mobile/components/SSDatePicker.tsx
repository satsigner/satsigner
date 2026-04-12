import { LinearGradient } from 'expo-linear-gradient'
import React, { useEffect, useRef, useState } from 'react'
import {
  type DimensionValue,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native'

type DateBlockProps = {
  digits: number[]
  value: number
  type: string
  height: number
  fontSize?: number
  textColor?: string
  markColor?: string
  markHeight?: number
  markWidth?: number | string
  fadeColor?: string

  onChange(type: string, digit: number): void
}

type SSDatePickerProps = {
  value: Date | null | undefined
  height?: number
  width?: number | string
  fontSize?: number
  textColor?: string
  startYear?: number
  endYear?: number
  markColor?: string
  markHeight?: number
  markWidth?: number | string
  fadeColor?: string
  format?: string

  onChange(value: Date): void
}

function SSDatePicker({
  value,
  onChange,
  height,
  width,
  fontSize,
  textColor,
  startYear,
  endYear,
  markColor,
  markHeight,
  markWidth,
  fadeColor,
  format
}: SSDatePickerProps) {
  const { height: windowHeight } = useWindowDimensions()
  const [days, setDays] = useState<number[]>([])
  const [months, setMonths] = useState<number[]>([])
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number>(() =>
    new Date().getFullYear()
  )
  const [selectedMonth, setSelectedMonth] = useState<number>(
    () => new Date().getMonth() + 1
  )

  useEffect(() => {
    const end = endYear || new Date().getFullYear()
    const start = !startYear || startYear > end ? end - 100 : startYear

    const days = Array.from({ length: 31 }, (_, index) => index + 1)
    const months = Array.from({ length: 12 }, (_, index) => index + 1)
    const years = Array.from(
      { length: end - start + 1 },
      (_, index) => start + index
    )

    setDays(days)
    setMonths(months)
    setYears(years)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pickerHeight: number = Math.round(height || windowHeight / 3.5)
  const pickerWidth: number | string = width || '100%'

  const unexpectedDate: Date = new Date(years[0], 0, 1)
  const date = new Date(value || unexpectedDate)

  const changeHandle = (type: string, digit: number): void => {
    const newDate = new Date(date)

    switch (type) {
      case 'day':
        newDate.setDate(digit)
        break
      case 'month':
        setSelectedMonth(digit)
        newDate.setMonth(digit - 1)
        break
      case 'year':
        setSelectedYear(digit)
        newDate.setFullYear(digit)
        break
      default:
        break
    }

    const now = new Date()
    if (newDate > now) {
      onChange(now)
    } else {
      onChange(newDate)
    }
  }

  const getDaysInMonth = (month: number, year: number) =>
    new Date(year, month, 0).getDate()

  const getOrder = () => {
    const now = new Date()
    const isCurrentYear = selectedYear === now.getFullYear()
    const isCurrentMonth = selectedMonth === now.getMonth() + 1

    const maxMonth = isCurrentYear ? now.getMonth() + 1 : 12
    const maxDay =
      isCurrentYear && isCurrentMonth
        ? now.getDate()
        : getDaysInMonth(selectedMonth, selectedYear)

    const filteredMonths = months.filter((m) => m <= maxMonth)
    const filteredDays = days.filter((d) => d <= maxDay)

    return (format || 'dd-mm-yyyy').split('-').map((type, index) => {
      switch (type) {
        case 'dd':
          return { digits: filteredDays, name: 'day', value: date.getDate() }
        case 'mm':
          return { digits: filteredMonths, name: 'month', value: selectedMonth }
        case 'yyyy':
          return { digits: years, name: 'year', value: selectedYear }
        default:
          return {
            digits: [filteredDays, filteredMonths, years][index],
            name: ['day', 'month', 'year'][index],
            value: [date.getDate(), selectedMonth, selectedYear][index]
          }
      }
    })
  }

  return (
    <View
      style={[
        styles.picker,
        { height: pickerHeight, width: pickerWidth as DimensionValue }
      ]}
    >
      {getOrder().map((el, index) => (
        <DateBlock
          digits={el.digits}
          value={el.value}
          onChange={changeHandle}
          height={pickerHeight}
          fontSize={fontSize}
          textColor={textColor}
          markColor={markColor}
          markHeight={markHeight}
          markWidth={markWidth}
          fadeColor={fadeColor}
          type={el.name}
          key={index}
        />
      ))}
    </View>
  )
}

function DateBlock({
  value,
  digits,
  type,
  onChange,
  height,
  fontSize,
  textColor,
  markColor,
  markHeight,
  markWidth,
  fadeColor
}: DateBlockProps) {
  const dHeight: number = Math.round(height / 4)

  const mHeight: number = markHeight || Math.min(dHeight, 65)
  const mWidth: number | string = markWidth || '70%'

  const offsets = digits.map((_: number, index: number) => index * dHeight)

  const fadeFilled: string = hex2rgba(fadeColor || '#ffffff', 1)
  const fadeTransparent: string = hex2rgba('#000000', 0.7)

  const scrollRef = useRef<ScrollView>(null)

  const snapScrollToIndex = (index: number) => {
    scrollRef?.current?.scrollTo({ animated: true, y: dHeight * index })
  }

  useEffect(() => {
    setTimeout(() => {
      snapScrollToIndex(value - digits[0])
    }, 0)
  }, [scrollRef.current]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMomentumScrollEnd = ({
    nativeEvent
  }: {
    nativeEvent: { contentOffset: { y: number } }
  }) => {
    const digit = Math.round(nativeEvent.contentOffset.y / dHeight + digits[0])
    onChange(type, digit)
  }

  return (
    <View style={styles.block}>
      <View
        style={[
          styles.mark,
          {
            backgroundColor: markColor || 'rgba(0, 0, 0, 0.05)',
            height: mHeight,
            top: (height - mHeight) / 2,
            width: mWidth as DimensionValue
          }
        ]}
      />
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        snapToOffsets={offsets}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={0}
        nestedScrollEnabled
        onMomentumScrollEnd={handleMomentumScrollEnd}
      >
        {digits.map((value: number, index: number) => (
          <TouchableOpacity
            key={index}
            onPress={() => {
              onChange(type, digits[index])
              snapScrollToIndex(index)
            }}
          >
            <Text
              style={[
                styles.digit,
                {
                  color: textColor || '#000000',
                  fontSize: fontSize || 22,
                  height: dHeight,
                  lineHeight: dHeight,
                  marginBottom:
                    index === digits.length - 1 ? height / 2 - dHeight / 2 : 0,
                  marginTop: index === 0 ? height / 2 - dHeight / 2 : 0
                }
              ]}
            >
              {value}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <LinearGradient
        style={[styles.gradient, { bottom: 0, height: height / 3 }]}
        colors={[fadeTransparent, fadeFilled]}
        pointerEvents="none"
      />
      <LinearGradient
        style={[styles.gradient, { height: height / 3, top: 0 }]}
        colors={[fadeFilled, fadeTransparent]}
        pointerEvents="none"
      />
    </View>
  )
}

const hex2rgba = (hex: string, alpha: number): string => {
  const cleanHex = hex.replace('#', '')

  const r: number = parseInt(
    cleanHex.length === 3
      ? cleanHex.slice(0, 1).repeat(2)
      : cleanHex.slice(0, 2),
    16
  )
  const g: number = parseInt(
    cleanHex.length === 3
      ? cleanHex.slice(1, 2).repeat(2)
      : cleanHex.slice(2, 4),
    16
  )
  const b: number = parseInt(
    cleanHex.length === 3
      ? cleanHex.slice(2, 3).repeat(2)
      : cleanHex.slice(4, 6),
    16
  )

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const styles = StyleSheet.create({
  block: {
    alignItems: 'center',
    flex: 1,
    height: '100%',
    justifyContent: 'center'
  },
  digit: {
    fontSize: 20,
    textAlign: 'center'
  },
  gradient: {
    position: 'absolute',
    width: '100%'
  },
  mark: {
    borderRadius: 10,
    position: 'absolute'
  },
  picker: {
    flexDirection: 'row',
    width: '100%'
  },
  scroll: {
    width: '100%'
  }
})

export default SSDatePicker
