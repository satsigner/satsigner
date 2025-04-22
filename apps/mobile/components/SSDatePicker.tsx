import { LinearGradient } from 'expo-linear-gradient'
import React, { useEffect, useRef, useState } from 'react'
import {
  Dimensions,
  type DimensionValue,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
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
  const [days, setDays] = useState<number[]>([])
  const [months, setMonths] = useState<number[]>([])
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear()
  )
  const [selectedMonth, setSelectedMonth] = useState<number>(
    new Date().getMonth() + 1
  )

  useEffect(() => {
    const end = endYear || new Date().getFullYear()
    const start = !startYear || startYear > end ? end - 100 : startYear

    const _days = [...Array(31)].map((_, index) => index + 1)
    const _months = [...Array(12)].map((_, index) => index + 1)
    const _years = [...Array(end - start + 1)].map((_, index) => start + index)

    setDays(_days)
    setMonths(_months)
    setYears(_years)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pickerHeight: number = Math.round(
    height || Dimensions.get('window').height / 3.5
  )
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
    }

    const now = new Date()
    if (newDate > now) {
      onChange(now)
    } else {
      onChange(newDate)
    }
  }

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month, 0).getDate()
  }

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
          return { name: 'day', digits: filteredDays, value: date.getDate() }
        case 'mm':
          return { name: 'month', digits: filteredMonths, value: selectedMonth }
        case 'yyyy':
          return { name: 'year', digits: years, value: selectedYear }
        default:
          return {
            name: ['day', 'month', 'year'][index],
            digits: [filteredDays, filteredMonths, years][index],
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
      {getOrder().map((el, index) => {
        return (
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
        )
      })}
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

  const scrollRef = useRef<any>(null)

  const snapScrollToIndex = (index: number) => {
    scrollRef?.current?.scrollTo({ y: dHeight * index, animated: true })
  }

  useEffect(() => {
    setTimeout(() => {
      snapScrollToIndex(value - digits[0])
    }, 0)
  }, [scrollRef.current]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMomentumScrollEnd = ({ nativeEvent }: any) => {
    const digit = Math.round(nativeEvent.contentOffset.y / dHeight + digits[0])
    onChange(type, digit)
  }

  return (
    <View style={styles.block}>
      <View
        style={[
          styles.mark,
          {
            top: (height - mHeight) / 2,
            backgroundColor: markColor || 'rgba(0, 0, 0, 0.05)',
            height: mHeight,
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
        {digits.map((value: number, index: number) => {
          return (
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
                    fontSize: fontSize || 22,
                    color: textColor || '#000000',
                    marginBottom:
                      index === digits.length - 1
                        ? height / 2 - dHeight / 2
                        : 0,
                    marginTop: index === 0 ? height / 2 - dHeight / 2 : 0,
                    lineHeight: dHeight,
                    height: dHeight
                  }
                ]}
              >
                {value}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
      <LinearGradient
        style={[styles.gradient, { bottom: 0, height: height / 3 }]}
        colors={[fadeTransparent, fadeFilled]}
        pointerEvents="none"
      />
      <LinearGradient
        style={[styles.gradient, { top: 0, height: height / 3 }]}
        colors={[fadeFilled, fadeTransparent]}
        pointerEvents="none"
      />
    </View>
  )
}

const hex2rgba = (hex: string, alpha: number): string => {
  hex = hex.replace('#', '')

  const r: number = parseInt(
    hex.length === 3 ? hex.slice(0, 1).repeat(2) : hex.slice(0, 2),
    16
  )
  const g: number = parseInt(
    hex.length === 3 ? hex.slice(1, 2).repeat(2) : hex.slice(2, 4),
    16
  )
  const b: number = parseInt(
    hex.length === 3 ? hex.slice(2, 3).repeat(2) : hex.slice(4, 6),
    16
  )

  return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')'
}

const styles = StyleSheet.create({
  picker: {
    flexDirection: 'row',
    width: '100%'
  },
  block: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%'
  },
  scroll: {
    width: '100%'
  },
  digit: {
    fontSize: 20,
    textAlign: 'center'
  },
  mark: {
    position: 'absolute',
    borderRadius: 10
  },
  gradient: {
    position: 'absolute',
    width: '100%'
  }
})

export default SSDatePicker
