import SSButton from "./SSButton";
import SSHStack from "@/layouts/SSHStack";
import { hStack, type HStackGap } from "@/styles/layout";
import { DimensionValue, StyleSheet, View } from "react-native";
import { range, shuffle } from "@/utils/array";

type SSNumericKeyboardProps = {
  random?: boolean;
  onPress?: (digit: string) => void;
  digits?: string[];
  nCols?: number;
  gap?: HStackGap;
};

const NUMERIC_PAD = [
  ...range(10, 1).map((x) => x.toString()), '0'
]

export default function SSKeyboard({
  gap = "xs",
  onPress,
  digits = NUMERIC_PAD,
  nCols = 3,
  random = false,
}: SSNumericKeyboardProps) {
  const pad = random ? shuffle(digits) : digits;
  const nRows = Math.ceil(pad.length / nCols);
  const cellWidth: DimensionValue = `${Math.floor(100 / nCols)}%`;

  function handleOnPress(digit: string) {
    if (onPress) {
      onPress(digit);
    }
  }

  return (
    <View>
      {range(nRows).map((i) => (
        <SSHStack key={i} style={styles.row}>
          {range(nCols).map((j) => {
            const index = i * nCols + j;

            if (index >= pad.length) {
              return null;
            }

            const digit = pad[index];
            return (
              <View
                key={index}
                style={{
                  width: cellWidth,
                  padding: hStack["gap"][gap],
                }}
              >
                <SSButton
                  key={index}
                  label={digit}
                  onPress={() => handleOnPress(digit)}
                />
              </View>
            );
          })}
        </SSHStack>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 0,
    alignSelf: 'center',
  },
});
