import SSButton from "./SSButton";
import SSHStack from "@/layouts/SSHStack";
import { hStack, type HStackGap } from "@/styles/layout";
import { DimensionValue, StyleSheet, View } from "react-native";
import { range, shuffle } from "@/utils/array";

type SSKeyboardProps = {
  onPress?: (item: string) => void;
  random?: boolean;
  items?: string[];
  nCols?: number;
  gap?: HStackGap;
};

const NUMERIC_PAD = [...range(10, 1).map((x) => x.toString()), "0"];

export default function SSKeyboard({
  onPress,
  gap = "xs",
  items = NUMERIC_PAD,
  nCols = 3,
  random = false,
}: SSKeyboardProps) {
  const pad = random ? shuffle(items) : items;
  const nRows = Math.ceil(pad.length / nCols);
  const cellWidth: DimensionValue = `${Math.floor(100 / nCols)}%`;

  function handleOnPress(item: string) {
    if (onPress) {
      onPress(item);
    }
  }

  function SSKeyboardItem({ index }: { index: number }) {
    if (index >= pad.length) {
      return null;
    }

    const item = pad[index];

    return (
      <View
        style={{
          width: cellWidth,
          padding: hStack["gap"][gap],
        }}
      >
        <SSButton
          key={index}
          label={item}
          onPress={() => handleOnPress(item)}
        />
      </View>
    );
  }

  return (
    <View>
      {range(nRows).map((i) => (
        <SSHStack key={i} style={styles.row}>
          {range(nCols).map((j) => (
            <SSKeyboardItem
              index={i * nCols + j}
              key={i * nCols + j}
            />
          ))}
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
    alignSelf: "center",
  },
});
